# Especificación Técnica: Migración SQLite → MongoDB (Etapa 26A)

**Proyecto:** Sistema Web de Reservas de Citas

Estado: COMPLETADA (Migración SQLite → MongoDB cerrada en Etapa 26F)

**Metodología:** Ágil + Spec-Driven Development (SDD) + BDD

> **Nota de cierre de migración:**
> - **Etapa 26B completada:** Infraestructura MongoDB (`mongodb` driver, `MongoClient`, `ensureIndexes`, `withTransaction`, entorno Replica Set `rs0`).
> - **Etapa 26C completada:** Preparación `async/await` y repositorios base MongoDB como adaptadores de compatibilidad.
> - **Etapa 26D completada:** Repositorios de agenda, citas, notificaciones, dashboard, `professionalDayLocks` y pruebas de concurrencia.
> - **Etapa 26E completada:** Cutover atómico del runtime productivo a MongoDB.
> - **Etapa 26F completada:** Retirada definitiva de SQLite (`better-sqlite3`, `connection.js`, `transaction.js`, `migrate.js`, `migrations/`), seed demo reproducible y consolidación final.
>
> **Trazabilidad histórica:** La consigna inicial del proyecto utilizó SQLite (`better-sqlite3`) y posteriormente, por nueva indicación del docente, se migró a MongoDB. Las secciones de este documento que describen SQLite representan la **arquitectura previa / baseline histórico** y **no** la arquitectura actual del runtime.

---

## 1. Objetivo

Diseñar formalmente la migración de la capa de persistencia del backend desde **SQLite (`better-sqlite3`)** hacia **MongoDB**, preservando al 100% el comportamiento funcional, las reglas de negocio y los contratos públicos actuales.

### Invariantes que deben mantenerse intactos
- API REST (`/api/v1/*`), rutas, métodos HTTP y códigos de estado (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `500`).
- Contratos JSON de request y response (`to...Response()`).
- Autenticación JWT y autorización RBAC (`ADMIN`, `RECEPTIONIST`, `PROFESSIONAL`, `CLIENT`).
- Aislamiento multi-tenant estricto por `organizationId` derivado de la identidad autenticada.
- Disponibilidad calculada dinámicamente (`WeeklySchedule - AvailabilityBlocks - Appointments activos`).
- Ciclo de vida de citas (`PROGRAMADA`, `CONFIRMADA`, `COMPLETADA`, `CANCELADA`, `NO_ASISTIO`), snapshots de duración/precio y notificaciones.
- Prevención estricta de doble reserva (double booking) bajo concurrencia real, permitiendo citas consecutivas (`fin anterior == inicio nueva`).

---

## 2. Estado actual SQLite

El backend actual utiliza `better-sqlite3` (`^12.4.1`) de forma **síncrona** con un archivo SQLite local (`DB_PATH`, por defecto `./data/reservas.db`), `PRAGMA foreign_keys = ON` y 10 migraciones SQL secuenciales en `backend/src/database/migrations/`.

- **Patrón arquitectónico:** `Routes → Middleware → Controller → Service → Repository → SQLite (getDb())`.
- **Transacciones actuales:** `runInTransaction(cb)` y `runInImmediateTransaction(cb)` en `backend/src/database/transaction.js`, basadas en `db.transaction(cb)` y `db.transaction(cb).immediate()`.

---

## 3. Inventario de dependencias SQLite

### 3.1 Dependencia en `backend/package.json`
- `"better-sqlite3": "^12.4.1"`

### 3.2 Archivos de infraestructura de base de datos y arranque
1. `backend/src/server.js` — invoca `getDb()` al arrancar el servidor.
2. `backend/src/database/connection.js` — importa `better-sqlite3`, abre `Database(dbFilePath)`, configura `foreign_keys = ON` y exporta `getDb()`.
3. `backend/src/database/migrate.js` — ejecuta migraciones `.sql` usando `getDb()`, `db.prepare(...)` y `db.transaction(...)`.
4. `backend/src/database/transaction.js` — exporta `runInTransaction` y `runInImmediateTransaction` usando `getDb().transaction(...)`.
5. `backend/src/database/migrations/001_*.sql` … `010_*.sql` — definiciones DDL de tablas, `CHECK`, `UNIQUE`, `FOREIGN KEY` e índices.

### 3.3 Repositorios dependientes de `getDb()` y SQL
6. `backend/src/modules/organizations/organization.repository.js`
7. `backend/src/modules/userAccounts/userAccount.repository.js`
8. `backend/src/modules/services/service.repository.js`
9. `backend/src/modules/professionals/professional.repository.js`
10. `backend/src/modules/professionalServices/professionalService.repository.js`
11. `backend/src/modules/weeklySchedules/weeklySchedule.repository.js`
12. `backend/src/modules/availabilityBlocks/availabilityBlock.repository.js`
13. `backend/src/modules/clients/client.repository.js`
14. `backend/src/modules/appointments/appointment.repository.js`
15. `backend/src/modules/notifications/notification.repository.js`
16. `backend/src/modules/dashboard/dashboard.repository.js`

### 3.4 Services acoplados a transacciones SQLite
17. `backend/src/modules/onboarding/onboarding.service.js` (`runInTransaction`)
18. `backend/src/modules/appointments/appointment.service.js` (`runInImmediateTransaction`)
19. `backend/src/modules/clients/client.service.js` (`runInImmediateTransaction`)
20. `backend/src/modules/professionals/professional.service.js` (`runInImmediateTransaction`)

> **Nota:** Los módulos `auth`, `availability`, `self`, `middleware/` y `*.controller.js` no importan `getDb()` directamente, pero consumen los repositorios/servicios anteriores de forma síncrona y se verán impactados por la conversión a `async/await`.

---

## 4. Decisión Driver vs Mongoose

| Criterio | MongoDB Node.js Driver Oficial (`mongodb`) | Mongoose ODM |
| --- | --- | --- |
| **Arquitectura Controller–Service–Repository** | Encaja de forma natural: los repositorios encapsulan `collection.find/insertOne/updateOne` y devuelven objetos planos. | Tiende a acoplar lógica de negocio y validación en Schemas/Models (ActiveRecord). |
| **Cantidad de código a modificar** | Menor: se reemplazan únicamente las consultas SQL dentro de `*.repository.js` y la capa `database/`. | Mayor: requiere definir 10+ Schemas, hidratación, `.lean()`, middlewares y adaptadores. |
| **Validación existente en Services** | Se reutiliza intacta; no hay duplicación de reglas entre Services y Schemas. | Duplica validaciones ya existentes en Services o genera errores `ValidationError` propios a traducir. |
| **Transacciones y control de concurrencia** | Control directo y explícito de `MongoClient`, `ClientSession`, `session.withTransaction(...)` y `findOneAndUpdate`. | Agrega una capa intermedia sobre `ClientSession` sin aportar ventaja real para locks. |
| **Índices y UUIDs actuales** | Soporte directo de índices compuestos/únicos y `id: string` (UUID) sin fricción con `_id` / `ObjectId`. | Por defecto fuerza `_id: ObjectId` y virtual `id`, requiriendo overrides en cada schema. |
| **Testabilidad y simplicidad académica** | Alta: consultas explícitas, sin magia oculta de ODM, fácil de explicar en sustentación universitaria. | Mayor superficie de abstracción implícita (casting, hooks, populate). |

**Decisión:** Se selecciona el **MongoDB Node.js Driver oficial (`mongodb`)**.

---

## 5. Modelo MongoDB y Matriz de Persistencia

### 5.1 Estrategia de identificadores
- **Se conserva `id` como string UUID v4** (`randomUUID()` de `node:crypto`) en todas las entidades que actualmente tienen `id` (`organizations`, `userAccounts`, `services`, `professionals`, `weeklySchedules`, `availabilityBlocks`, `clients`, `appointments`, `notifications`).
- MongoDB genera y utiliza `_id` (`ObjectId`) internamente como clave primaria física de BSON, pero **`_id` nunca se expone fuera de los repositorios** (se proyecta `{ _id: 0 }` o se omite en `to...Response()`).
- Todas las referencias entre documentos (`organizationId`, `clientId`, `professionalId`, `serviceId`, `userAccountId`, `appointmentId`, `recipientUserAccountId`) siguen siendo **strings UUID**.
- **Justificación:** Minimiza cambios en Services, Controllers, JWT y Frontend; preserva el 100% de los contratos JSON actuales.

### 5.2 Matriz SQLite → MongoDB

| Tabla SQLite | Colección MongoDB | Campos clave / PK lógica | Índices principales | Invariantes |
| --- | --- | --- | --- | --- |
| `organizations` | `organizations` | `id` (UUID), `name`, `slug`, `isActive`, `createdAt`, `updatedAt` | `id` (UNIQUE), `slug` (UNIQUE) | `slug` único global; `name` y `slug` no vacíos. |
| `user_accounts` | `userAccounts` | `id` (UUID), `organizationId`, `email`, `passwordHash`, `role`, `isActive`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, email }` (UNIQUE) | Email único por organización; `role` en enum válido. |
| `services` | `services` | `id` (UUID), `organizationId`, `name`, `description`, `durationMinutes`, `priceMinorUnits`, `isActive`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, isActive, name }` | `durationMinutes > 0`; `priceMinorUnits >= 0`. |
| `professionals` | `professionals` | `id` (UUID), `organizationId`, `userAccountId`, `name`, `email`, `phone`, `isActive`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, userAccountId }` (UNIQUE parcial) | `userAccountId` único por org cuando no es `null`. |
| `professional_services` | `professionalServices` | `organizationId`, `professionalId`, `serviceId`, `createdAt` | `{ organizationId, professionalId, serviceId }` (UNIQUE), `{ organizationId, serviceId }` | Relación M:N única por tenant. |
| `weekly_schedules` | `weeklySchedules` | `id` (UUID), `organizationId`, `professionalId`, `dayOfWeek`, `startTime`, `endTime`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, professionalId, dayOfWeek, startTime, endTime }` (UNIQUE) | `dayOfWeek` 1..7; `startTime < endTime` (`HH:mm`). |
| `availability_blocks` | `availabilityBlocks` | `id` (UUID), `organizationId`, `professionalId`, `startAt`, `endAt`, `reason`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, professionalId, startAt, endAt }` (UNIQUE) | `startAt < endAt` (`YYYY-MM-DDTHH:mm`). |
| `clients` | `clients` | `id` (UUID), `organizationId`, `userAccountId`, `name`, `email`, `phone`, `isActive`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, userAccountId }` (UNIQUE parcial) | `userAccountId` único por org cuando no es `null`. |
| `appointments` | `appointments` | `id` (UUID), `organizationId`, `clientId`, `professionalId`, `serviceId`, `startAt`, `endAt`, `serviceDurationMinutes`, `servicePriceMinorUnits`, `status`, `createdAt`, `updatedAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, professionalId, startAt, endAt }`, `{ organizationId, clientId, startAt }`, `{ organizationId, startAt, status }` | `startAt < endAt`; snapshots inmutables; sin solapes activos. |
| `notifications` | `notifications` | `id` (UUID), `organizationId`, `recipientUserAccountId`, `appointmentId`, `type`, `title`, `message`, `isRead`, `readAt`, `createdAt` | `{ organizationId, id }` (UNIQUE), `{ organizationId, recipientUserAccountId, isRead, createdAt }`, `{ organizationId, appointmentId }` | `isRead=false => readAt=null`; `isRead=true => readAt!=null`. |
| *(Nueva interna)* | `professionalDayLocks` | `organizationId`, `professionalId`, `date` (`YYYY-MM-DD`), `seq`, `updatedAt` | `{ organizationId, professionalId, date }` (UNIQUE) | Documento de coordinación de concurrencia (no expuesto en API). |

---

## 6. Colecciones propuestas

Se mantienen **10 colecciones de dominio** equivalentes a las 10 tablas actuales, más **1 colección interna de control de concurrencia** (`professionalDayLocks`):

1. `organizations`
2. `userAccounts`
3. `services`
4. `professionals`
5. `professionalServices`
6. `weeklySchedules`
7. `availabilityBlocks`
8. `clients`
9. `appointments`
10. `notifications`
11. `professionalDayLocks` *(solo uso interno transaccional)*

**Justificación contra embedding masivo:**
- `appointments` y `notifications` crecen de forma indefinida; embeberlas dentro de `organizations`, `professionals` o `clients` arriesgaría superar el límite de 16 MB por documento BSON y generaría contención de escritura.
- `services`, `professionals`, `clients`, `weeklySchedules` y `availabilityBlocks` se consultan, filtran y actualizan de forma independiente.
- Mantener colecciones separadas con referencias por `id` + `organizationId` conserva la trazabilidad 1:1 con los repositorios existentes.

---

## 7. Esquema lógico de campos y mapeo de tipos

### Convenciones de tipos en MongoDB
- **IDs:** `string` (UUID v4).
- **Booleanos (`isActive`, `isRead`):** `boolean` nativo (`true` / `false`) en lugar de `0` / `1` de SQLite.
- **Dinero (`priceMinorUnits`, `servicePriceMinorUnits`):** `number` entero en unidades menores (centavos).
- **Fechas operacionales (`startAt`, `endAt`):** `string` local con formato `YYYY-MM-DDTHH:mm` (ej. `"2026-11-20T09:00"`).
- **Horas semanales (`startTime`, `endTime`):** `string` local `HH:mm` (ej. `"09:00"`).
- **Timestamps de auditoría (`createdAt`, `updatedAt`, `readAt`):** `string` ISO-8601 (`new Date().toISOString()`).

**Decisión sobre fechas operacionales:** Se conservan como **strings locales `YYYY-MM-DDTHH:mm`** (Opción A) y **NO** se migran a BSON `Date` UTC. El dominio opera en horario local de la organización sin almacenar zona horaria por cita, y las comparaciones lexicográficas (`startAt < endAt`, rangos `[rangeStart, rangeEnd)`) ya están validadas y probadas con este formato.

---

## 8. Índices detallados por colección

1. **`organizations`**
   - `{ id: 1 }` (`unique: true`)
   - `{ slug: 1 }` (`unique: true`)
2. **`userAccounts`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, email: 1 }` (`unique: true`)
   *(Toda consulta tenant-scoped debe filtrar por `organizationId`; no se crea índice global `{ id: 1 }` sin `organizationId`.)*
3. **`services`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, isActive: 1, name: 1 }` *(listados activos y dashboard)*
4. **`professionals`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, userAccountId: 1 }` (`unique: true, partialFilterExpression: { userAccountId: { $type: 'string' } }`)
   - `{ organizationId: 1, isActive: 1, name: 1 }` *(listados activos y dashboard)*
5. **`professionalServices`**
   - `{ organizationId: 1, professionalId: 1, serviceId: 1 }` (`unique: true`)
   - `{ organizationId: 1, serviceId: 1 }` *(consulta de disponibilidad por servicio sin `professionalId`)*
6. **`weeklySchedules`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, professionalId: 1, dayOfWeek: 1, startTime: 1, endTime: 1 }` (`unique: true`)
7. **`availabilityBlocks`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, professionalId: 1, startAt: 1, endAt: 1 }` (`unique: true`)
8. **`clients`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, userAccountId: 1 }` (`unique: true, partialFilterExpression: { userAccountId: { $type: 'string' } }`)
   - `{ organizationId: 1, isActive: 1, name: 1 }`
9. **`appointments`**
   - `{ organizationId: 1, id: 1 }` (`unique: true`)
   - `{ organizationId: 1, professionalId: 1, status: 1, startAt: 1, endAt: 1 }` *(overlap, availability y filtros por profesional)*
   - `{ organizationId: 1, clientId: 1, startAt: 1 }` *(filtros por cliente y `/self`)*
   - `{ organizationId: 1, startAt: 1, status: 1 }` *(listado general y dashboard por rango)*
   - `{ organizationId: 1, serviceId: 1, startAt: 1 }` *(filtros por servicio)*
10. **`notifications`**
    - `{ organizationId: 1, id: 1 }` (`unique: true`)
    - `{ organizationId: 1, recipientUserAccountId: 1, isRead: 1, createdAt: -1, id: -1 }` *(bandeja de notificaciones y conteo de no leídas)*
    - `{ organizationId: 1, appointmentId: 1 }`
11. **`professionalDayLocks`**
    - `{ organizationId: 1, professionalId: 1, date: 1 }` (`unique: true`)

---

## 9. Multi-tenancy

- Toda colección tenant-scoped incluye obligatoriamente el campo `organizationId`.
- Todos los índices principales comienzan por `organizationId: 1` (prefijo de particionamiento lógico).
- Ningún endpoint protegido acepta `organizationId` desde `req.body`, `req.query` ni headers arbitrarios; siempre se toma de `req.user.organizationId` (JWT verificado).
- Toda consulta en repositorios tenant-scoped incluye `organizationId` en el filtro (`{ organizationId, ... }`).

---

## 10. Transacciones actuales y su equivalente MongoDB

| Ubicación actual | Tipo SQLite | Operaciones agrupadas | Invariante protegida | Riesgo si falla parcialmente | Equivalente MongoDB |
| --- | --- | --- | --- | --- | --- |
| `onboarding.service.js:59` | `runInTransaction` | `resolveAvailableSlug` + `insertOrganization` + `insertUserAccount` (ADMIN) | Organización creada siempre con su primer ADMIN. | Organización huérfana sin usuario administrador. | `withTransaction(async (session) => ...)` pasando `session` a ambos inserts. |
| `appointment.service.js:291` (`createAppointment`) | `runInImmediateTransaction` | Validar cliente/profesional/servicio/asignación + `assertSlotAvailable` + `insertAppointment` + `createAppointmentEventNotifications` | Sin doble reserva; cita y notificaciones nacen juntas. | Doble reserva concurrente o cita sin notificaciones. | `withTransaction` + lock en `professionalDayLocks` + `session` en lecturas/escrituras. |
| `appointment.service.js:446` (`rescheduleAppointment`) | `runInImmediateTransaction` | Validar cita y estado + validar recursos activos + `assertSlotAvailable` (excluyendo `id`) + `updateAppointmentSchedule` + notificaciones | Sin doble reserva al mover horario; estado vuelve a `PROGRAMADA`. | Solapamiento en nuevo horario o notificación inconsistente. | `withTransaction` + lock en `professionalDayLocks` para la fecha destino + `session`. |
| `appointment.service.js:232` (`applyStatusTransition`) | `runInImmediateTransaction` | Leer cita + validar transición + `updateStatus` + notificaciones (`confirm`, `cancel`) | Transición de estado atómica con su notificación. | Estado cambiado sin notificación o viceversa. | `withTransaction` pasando `session` a `findById`, `updateStatus` e `insertNotification`. |
| `client.service.js:166` (`removeClient`) | `runInImmediateTransaction` | Leer cliente + `deactivateClient` + `deactivateUserAccount` (si tiene cuenta) | Cliente desactivado no conserva cuenta activa. | Cliente inactivo con login activo. | `withTransaction` pasando `session` a ambos updates. |
| `client.service.js:186` (`provisionClientAccount`) | `runInImmediateTransaction` | Validar cliente activo sin cuenta + validar email único + `insertUserAccount` + `linkUserAccount` | Vínculo 1:1 `client ↔ userAccount`. | `userAccount` huérfana sin enlazar al cliente. | `withTransaction` pasando `session` + índice único `{ organizationId, email }`. |
| `professional.service.js:147` (`removeProfessional`) | `runInImmediateTransaction` | Leer profesional + `deactivateProfessional` + `deactivateUserAccount` | Profesional desactivado no conserva cuenta activa. | Profesional inactivo con login activo. | `withTransaction` pasando `session` a ambos updates. |
| `professional.service.js:167` (`provisionProfessionalAccount`) | `runInImmediateTransaction` | Validar profesional activo sin cuenta + validar email único + `insertUserAccount` + `linkUserAccount` | Vínculo 1:1 `professional ↔ userAccount`. | `userAccount` huérfana sin enlazar al profesional. | `withTransaction` pasando `session` + índice único `{ organizationId, email }`. |

---

## 11. Concurrencia de Appointment y Estrategia Anti-Double-Booking

### 11.1 Por qué una transacción MongoDB por sí sola NO basta
MongoDB (WiredTiger) ejecuta transacciones bajo **Snapshot Isolation**. Si `Request A` y `Request B` inician transacción simultáneamente para reservar `Professional P` de `09:00` a `10:00`:
1. Ambos leen su propio snapshot donde no existe cita alguna.
2. Ambos evalúan `hasActiveOverlap(...) === false`.
3. Ambos insertan documentos distintos en `appointments` (con distinto `id`).
4. Ambos hacen commit sin conflicto de escritura porque modifican documentos diferentes (**write skew**), produciendo **doble reserva**.

### 11.2 Estrategia elegida: Opción A — Transacción + Documento de lock por `(organizationId, professionalId, date)`
Se utilizará la colección interna **`professionalDayLocks`** con índice único `{ organizationId: 1, professionalId: 1, date: 1 }`.

#### Algoritmo paso a paso (`createAppointment` y `rescheduleAppointment`)
1. Calcular `endAt = addMinutes(startAt, service.durationMinutes)` y `date = getDatePart(startAt)`. Verificar que `getDatePart(endAt) === date`.
   - **Alcance del lock en `createAppointment`:** lock sobre `(organizationId, professionalId, date)` de la fecha destino de la cita.
   - **Alcance del lock en `rescheduleAppointment`:** lock sobre `(organizationId, professionalId, date)` de la **FECHA DESTINO** (`targetDate`). Si `origen == destino`, es el mismo documento de lock; si `origen != destino`, la fecha destino es la necesaria para proteger la nueva ocupación contra double booking. No se añaden locks adicionales sin una invariante concreta que lo requiera.
2. Iniciar `withTransaction(async (session) => { ... })`:
   - **Paso 1 (Adquisición de lock de escritura):** Ejecutar sobre `professionalDayLocks`:
     ```js
     await db.collection('professionalDayLocks').findOneAndUpdate(
       { organizationId, professionalId, date },
       { $inc: { seq: 1 }, $set: { updatedAt: now } },
       { upsert: true, session }
     );
     ```
     *Nota sobre carrera inicial de `upsert` (`E11000`):* Si el documento aún no existe y dos requests simultáneos intentan hacer `upsert: true`, MongoDB puede lanzar `E11000` sobre el índice único de `professionalDayLocks` `{ organizationId, professionalId, date }`. **No debe asumirse automáticamente que todo `E11000` es `TransientTransactionError`**: únicamente cuando el `E11000` corresponda de forma específica al índice único de `professionalDayLocks`, el wrapper realizará un reintento acotado de la **transacción completa**. Cualquier otro `E11000` se traduce según su invariante de negocio.
   - **Paso 2 (Revalidación dentro del snapshot serializado):**
     - Validar recursos activos (`client`, `professional`, `service`, `professionalService`).
     - Validar `weeklySchedule` cubriente y ausencia de `availabilityBlocks` solapados.
     - Ejecutar `hasActiveOverlap` (`status IN ['PROGRAMADA', 'CONFIRMADA']`, `startAt < newEndAt`, `endAt > newStartAt`, excluyendo `excludeAppointmentId` en reschedule).
   - **Paso 3 (Persistencia atómica):**
     - Si hay solape → lanzar `httpError(409, 'El profesional ya tiene una cita en ese horario')` (aborta la transacción).
     - Si no hay solape → insertar/actualizar cita en `appointments` e insertar notificaciones en `notifications` usando `{ session }`.

#### Comportamiento bajo dos requests concurrentes (`A` y `B` para `P`, `09:00–10:00`)
- `A` y `B` ejecutan `findOneAndUpdate` sobre el mismo documento `{ organizationId, professionalId: P, date }`.
- WiredTiger serializa la escritura de ese documento: `A` adquiere el write lock; `B` recibe `WriteConflict` (`TransientTransactionError`).
- `A` valida que no hay overlap, inserta la cita y hace commit.
- El helper `withTransaction` reintenta automáticamente la transacción de `B` con un **nuevo snapshot** (que ya incluye la cita de `A`).
- `B` vuelve a adquirir el lock, ejecuta `hasActiveOverlap`, detecta la cita de `A` y responde **`409 Conflict`** (`El profesional ya tiene una cita en ese horario`).
- Requests para **distintos profesionales** o **distintas fechas** tocan documentos de lock distintos y corren en paralelo sin bloqueo mutuo.
- Soporta cualquier duración de servicio y permite citas consecutivas (`09:00–10:00` y `10:00–11:00`) porque la detección sigue usando desigualdad estricta (`startAt < endAt && endAt > startAt`).

---

## 12. Transaction API (Abstracción propuesta)

En `backend/src/database/transaction.js` (o `mongodb/transaction.js`):

```js
export async function withTransaction(callback) {
  const client = getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      return await callback(session);
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
  } finally {
    await session.endSession();
  }
}
```

- **Propagación de `session`:** Todos los métodos de repositorio aceptarán un parámetro opcional `{ session } = {}` al final de su firma y lo reenviarán a las operaciones del driver (`find(..., { session })`, `insertOne(doc, { session })`, `updateOne(..., { session })`). Las operaciones Mongo relacionadas deben usar siempre la **misma `session`**.
- **Acoplamiento mínimo:** Los Services solo reciben `session` como token opaco devuelto por `withTransaction(async (session) => ...)` y lo pasan a los repositorios, sin importar tipos del driver `mongodb`.
- **Seguridad frente a reintentos (callback idempotente):** La callback de `session.withTransaction(...)` puede ejecutarse más de una vez debido a reintentos por errores transitorios. Por ello debe ser segura frente a reejecución:
  - Dentro de la callback **NO** deben ejecutarse efectos externos irreversibles (enviar emails, llamar APIs externas con efectos, escribir archivos o emitir eventos externos no transaccionales).
  - Las `Notifications` actuales sí pueden escribirse dentro de la misma transacción porque son documentos MongoDB asociados a la `session`.
  - Si se generan UUIDs dentro de una callback reintentada, un intento abortado no deja efectos persistidos.
- **Reintentos:** `session.withTransaction` del driver oficial reintenta automáticamente errores con etiqueta `TransientTransactionError` y `UnknownTransactionCommitResult`. Únicamente cuando `professionalDayLocks` produzca `E11000` sobre su índice único `{ organizationId, professionalId, date }` durante el `upsert` concurrente inicial, el wrapper realizará un reintento acotado de la **transacción completa** (máx. 5 intentos). Otros `E11000` **no** se reintentan genéricamente.

---

## 13. Contrato Repository → Service durante la migración

MongoDB almacena los documentos en **camelCase** y con **booleanos nativos** (`clientId`, `professionalId`, `serviceId`, `organizationId`, `isActive: true/false`, `isRead: true/false`, `startAt`, `endAt`).

Sin embargo, durante esta migración de persistencia, **los repositorios Mongo deben actuar como ADAPTADORES DE COMPATIBILIDAD** para los Services existentes:

- **Ejemplo:** Un documento almacenado en MongoDB como:
  ```js
  { clientId, professionalId, isActive: true }
  ```
  puede devolverse internamente desde el repositorio como:
  ```js
  { client_id, professional_id, is_active: 1 }
  ```
  cuando el Service actual dependa de esa forma (`snake_case` o `is_active === 1`).
- **Objetivo:** Separar claramente dos cambios distintos y **NO realizarlos simultáneamente**:
  1. Migración de persistencia `SQLite → MongoDB`.
  2. Refactorización futura de `snake_case → camelCase` interno y `0/1 → boolean` interno.
- La normalización interna completa a `camelCase` queda fuera del alcance de esta migración y podrá abordarse después como un refactor independiente.

---

## 13B. Impacto de Asincronía (`async/await`)

La migración de `better-sqlite3` (síncrono) a `mongodb` (asíncrono) requiere convertir a `async/await`:
1. **Repositorios (11 archivos):** Todas las funciones de lectura y escritura pasan a ser `async`, retornan `Promise` y adaptan los documentos MongoDB a la estructura interna esperada por los Services.
2. **Services (todos los módulos):**
   - `auth.service.js`, `onboarding.service.js`, `self.service.js`
   - `organization`, `userAccount`, `client.service.js`, `professional.service.js`, `service.service.js`
   - `professionalService.service.js`, `weeklySchedule.service.js`, `availabilityBlock.service.js`
   - `availability.service.js`, `appointment.service.js`, `notification.service.js`, `dashboard.service.js`
3. **Controllers (todos los módulos):** Deben usar `async (req, res, next)` y `await` al invocar a los Services, manteniendo el `try { ... } catch (error) { next(error); }`.
4. **Middleware:** `domainIdentity.middleware.js` (resolución de `professionalId` / `clientId` desde `userAccountId`) deberá usar `await` y manejar errores con `next(error)`.
5. **Startup (`server.js`):** Conectar a MongoDB y asegurar índices (`await connectMongo(); await ensureIndexes();`) antes de `app.listen(...)`.

---

## 14. Compatibilidad API

- Los repositorios actúan como adaptadores hacia los Services (manteniendo compatibilidad interna), y los mappers `to...Response()` (`toAppointmentResponse`, `toClientResponse`, `toProfessionalResponse`, `toServiceResponse`, `toNotificationResponse`, etc.) continúan devolviendo exactamente los mismos contratos JSON públicos camelCase actuales.
- Nunca se filtrará `_id`, `ObjectId`, `session` ni metadata interna de MongoDB hacia las respuestas HTTP.

---

## 15. Manejo de errores

El `errorHandler.js` y un helper de traducción en la capa de persistencia mapearán errores del driver MongoDB a `httpError(...)` sin filtrar nunca `MongoServerError`, stack traces ni nombres de índices internos:
- **Duplicate key (`error.code === 11000`):**
  - **Excepción acotada:** Únicamente cuando `E11000` corresponda específicamente al índice único de `professionalDayLocks` `{ organizationId, professionalId, date }` durante el `upsert` concurrente inicial, el wrapper reintentará de forma acotada la transacción completa.
  - **Otros `E11000` (no se reintentan genéricamente):** Se traducen según su invariante de negocio:
    - En `userAccounts` (`organizationId + email`) → `409` (`Ya existe una cuenta con ese correo`).
    - En `organizations` (`slug`) → reintento de generación de slug en `onboarding` o `409`.
    - En `professionalServices` / `weeklySchedules` / `availabilityBlocks` → `409`.
- **Regla estricta `409` vs `500` (sin introducir `503`):**
  - **`409 Conflict`:** Solo cuando existe un **conflicto de negocio demostrado** (ej. appointment overlap, recurso duplicado, transición de estado inválida).
  - **`500 Internal Server Error`:** Si se agotaron los reintentos técnicos de MongoDB (`WriteConflict` / `TransientTransactionError`) sin poder demostrar un conflicto funcional.
- **Errores de validación de negocio:** Siguen lanzándose desde Services con `httpError(400 | 401 | 403 | 404 | 409, mensaje)`.

---

## 16. Disponibilidad

- La disponibilidad **sigue siendo calculada dinámicamente** en `availability.service.js`.
- **NO** se crea una colección pública `availabilitySlots`.
- La fórmula permanece idéntica:
  $$\text{Slots disponibles} = \text{WeeklySchedule} - \text{AvailabilityBlocks} - \text{Appointments activos}$$
- Se respeta la duración completa del servicio y se mantiene el endpoint `GET /api/v1/availability` sin `professionalId` obligatorio (consulta en lote por `organizationId` y `serviceId`, evitando N+1).

---

## 17. Notificaciones

- `Appointment` es la **fuente autoritativa** del estado de la reserva; `Notification` es un registro derivado de eventos.
- Cuando una operación crea o modifica una cita (`createAppointment`, `rescheduleAppointment`, `confirm`, `cancel`), la inserción de notificaciones en `notifications` se ejecuta **dentro de la misma transacción (`{ session }`)**.
- De este modo, si falla la inserción de la notificación, la transacción completa se aborta y no queda una cita creada en estado inconsistente respecto a sus notificaciones.

---

## 18. Migración / Seed de datos

- **Recomendación para proyecto universitario en desarrollo:** **Opción B — Iniciar MongoDB limpio + script de índices y seed/demo data** (y opcionalmente un script auxiliar de importación si se requiere preservar una base de demostración puntual).
- **Justificación:** El esquema está en desarrollo activo, no hay datos productivos reales de clientes y el seed reproducible facilita pruebas automatizadas y sustentación.
- Si se llegara a migrar un snapshot SQLite existente, se validará: conteo exacto por colección, integridad de UUIDs, `organizationId` en cada documento, relaciones válidas y snapshots de `appointments`.

---

## 19. Configuración de entorno

| Entorno | Estrategia recomendada | Notas |
| --- | --- | --- |
| **Principal (Local)** | **Docker + MongoDB 8.0 configurado como Replica Set `rs0`** | **Obligatorio Replica Set** incluso en local; una instancia **MongoDB standalone NO sirve** para las transacciones multi-documento requeridas por este diseño. |
| **Alternativa** | **MongoDB Atlas (Free Tier)** | Replica Set gestionado en la nube, compatible con `withTransaction` sin configuración local adicional. |

### Variables de entorno futuras (`backend/.env`)
```env
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
MONGODB_DB_NAME=reservas
```
- La base de datos se selecciona explícitamente mediante `MONGODB_DB_NAME` (no incluir `/reservas` en el URI local).
- Atlas utilizará su propio `MONGODB_URI`, pero **nunca** se hardcodean credenciales ni URIs en el código fuente.

---

## 20. Estrategia de testing futura

Tras la migración se implementará una suite automatizada (usando `node:test` + `node:assert`) organizada en 4 niveles, manteniendo trazabilidad explícita con las **13 Historias de Usuario** y **52 criterios de aceptación** del proyecto:

1. **Unit / Service tests:** Validaciones de negocio, cálculo de slots, snapshots, transiciones de estado y mapeo de errores.
2. **API Integration tests:** Todos los endpoints REST contra MongoDB real (Replica Set):
   - Aislamiento multi-tenant entre organizaciones.
   - RBAC (`ADMIN`, `RECEPTIONIST`, `PROFESSIONAL`, `CLIENT`).
   - Onboarding atómico (organización + admin).
   - Unicidad de `professionalServices`, `weeklySchedules`, `availabilityBlocks` y `userAccounts`.
   - Disponibilidad calculada, bloques de indisponibilidad, filtros de citas, dashboard y notificaciones.
3. **Concurrency tests:**
   - **`CONC-MONGO-01`:** Dos `POST /appointments` simultáneos para el mismo `Professional` y el mismo intervalo deben producir exactamente **`1 × 201`** y **`1 × 409`**, y en MongoDB debe quedar exactamente **una** cita activa para ese intervalo.
   - **`CONC-MONGO-02`:** Dos citas consecutivas `09:00–10:00` y `10:00–11:00` deben devolver ambas **`201 PROGRAMADA`**.
4. **Acceptance tests (BDD):**
   - La migración a MongoDB ejecutará como gate mínimo la regresión de funcionalidades críticas y la suite completa de **HU-03** (TC-HU03-01 a TC-HU03-04) sin cambios en el frontend.
   - Posteriormente, la suite de aceptación global cubrirá los criterios de las **13 Historias de Usuario (52 criterios de aceptación)** según la matriz SDD del proyecto.

---

## 21. Secuencia propuesta de implementación incremental

Se define una secuencia de **5 etapas** que garantiza **una única fuente de verdad operativa** en cada commit (nunca `organizations` en MongoDB + `appointments` en SQLite simultáneamente):

1. **26B — Infraestructura MongoDB:**
   - Instalar el driver `mongodb` en `backend/package.json`.
   - Configurar variables de entorno (`MONGODB_URI`, `MONGODB_DB_NAME`) en `env.js`.
   - Implementar `MongoClient`, `ensureIndexes` y el transaction helper (`withTransaction`).
   - Preparar entorno local Replica Set `rs0` (Docker + MongoDB 8.0) o Atlas.
   - **SQLite continúa siendo la única fuente de verdad del runtime.** No se modifican repositorios productivos todavía.
2. **26C — Preparación async + repositories Mongo base:**
   - Convertir progresivamente las interfaces de Services/Controllers/Middleware necesarias a `async/await` (`await` funciona temporalmente sobre resultados síncronos de SQLite).
   - Implementar los repositorios Mongo base (`organizations`, `userAccounts`, `clients`, `professionals`, `services`) como código preparado en paralelo (actuando como adaptadores de compatibilidad).
   - **SQLite continúa siendo la única fuente de verdad operativa.** **NO** realizar cutover parcial.
3. **26D — Completar persistencia Mongo:**
   - Implementar TODOS los repositorios Mongo restantes (`professionalServices`, `weeklySchedules`, `availabilityBlocks`, `appointments`, `notifications`, `dashboard`).
   - Implementar propagación de `session`, `withTransaction`, `professionalDayLocks` y traducción de errores (`E11000`, `409` vs `500`).
   - Preparar pruebas de persistencia y concurrencia sobre MongoDB.
   - **SQLite todavía es la única fuente productiva** hasta que la capa MongoDB esté 100% completa.
4. **26E — CUTOVER ATÓMICO:**
   - Cambiar **TODO** el backend operativo de SQLite a MongoDB en una sola etapa coherente:
     - Todos los repositorios productivos pasan a usar MongoDB.
     - Todos los Services/Controllers necesarios operan en `async/await`.
     - `server.js` conecta a MongoDB y ejecuta `ensureIndexes()`.
     - Transacciones y `professionalDayLocks` quedan activos.
     - Se ejecutan las pruebas críticas, de integración y concurrencia (`CONC-MONGO-01`, `CONC-MONGO-02`, `HU-03`).
5. **26F — Retirada SQLite + regresión final:**
   - Solo **DESPUÉS** de validar el cutover sobre MongoDB:
     - Eliminar `better-sqlite3` de `package.json`.
     - Retirar `connection.js`, `migrate.js` y las migraciones SQL (`migrations/`).
     - Incorporar seed/demo reproducible en MongoDB.
     - Ejecutar suite completa (unit, integration, concurrency, acceptance) y cerrar documentación final.

---

## 22. Riesgos principales y mitigación

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| MongoDB local ejecutado en modo *standalone* (sin Replica Set) | Las transacciones multi-documento fallan en runtime. | Documentar e iniciar siempre con Docker + MongoDB 8.0 (`rs0`) o Atlas. |
| Carrera en `upsert: true` inicial sobre `professionalDayLocks` | Error `E11000` esporádico al crear el primer lock del día. | Reintento acotado de la transacción completa únicamente cuando `E11000` corresponda al índice único de `professionalDayLocks`. |
| Olvidar `await` al convertir funciones síncronas a `async` | Promesas sin resolver evaluadas como truthy en `if (...)`. | Conversión progresiva en 26C + revisión por módulo + pruebas de integración. |
| Divergencia de contrato interno si se mezcla migración con refactor | Errores silenciosos en Services (`snake_case` / `0/1` vs `camelCase` / `boolean`). | Mantener repositorios Mongo como **adaptadores de compatibilidad** durante la migración; dejar normalización interna para refactor posterior. |
| Filtración de `_id` o `MongoServerError` hacia la API | Ruptura de contratos JSON o exposición de detalles internos. | Proyección `{ _id: 0 }` / adaptación en repositorios y mapeo centralizado en `errorHandler.js`. |

---

## 23. Criterios de aceptación de la migración (futuros — Etapas 26B–26F)

- **MIG-01:** Ningún archivo del backend importa `better-sqlite3` ni ejecuta SQL.
- **MIG-02:** Todos los endpoints REST mantienen rutas, status HTTP y contratos JSON actuales.
- **MIG-03:** El aislamiento multi-tenant por `organizationId` y RBAC pasan todas las pruebas.
- **MIG-04:** Dos requests concurrentes para el mismo profesional e intervalo solapado producen exactamente un `201` y un `409`.
- **MIG-05:** Citas consecutivas (`09:00–10:00` y `10:00–11:00`) se crean ambas con `201 PROGRAMADA`.
- **MIG-06:** Todos los casos de HU-03 (TC-HU03-01 a TC-HU03-04) pasan sobre MongoDB sin cambios en el frontend.
