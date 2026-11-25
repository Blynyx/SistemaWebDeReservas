# Arquitectura del Sistema Web de Reservas de Citas

Este documento describe la arquitectura técnica vigente del sistema (stack MERN con MongoDB 8.0 Replica Set `rs0`). Para los detalles de migración desde SQLite y el modelo de colecciones/índices, véase [docs/specs/mongodb-migration-spec.md](../specs/mongodb-migration-spec.md). Para la operación local de MongoDB, véase [docs/ops/mongodb-local-setup.md](../ops/mongodb-local-setup.md).

---

## 1. Flujo de capas

```text
React (SPA) → REST API (/api/v1) → Middleware → Controller → Service → Repository → MongoDB (rs0)
```

### Responsabilidad de cada capa
- **React (SPA) (`frontend/src`):** interfaz separada por rol (`ADMIN`, `RECEPTIONIST`, `PROFESSIONAL`, `CLIENT`), manejo de sesión JWT en `AuthContext`, validaciones de formulario previas al request y visualizaciones interactivas (FullCalendar y Chart.js).
- **REST API (`/api/v1`) (`backend/src/routes/index.js` y `*.routes.js`):** enrutamiento HTTP versionado que asocia cada endpoint con sus middlewares de autenticación y autorización.
- **Middleware (`backend/src/middleware/`):**
  - `auth.middleware.js`: valida el token Bearer JWT, comprueba que el usuario exista y siga activo en su `organizationId`, e inyecta `req.auth`.
  - `authorizeRoles.middleware.js`: aplica RBAC estricto devolviendo `403` si el rol no está autorizado.
  - `errorHandler.js`: traduce errores de dominio (`httpError`) y errores inesperados a respuestas JSON consistentes sin filtrar detalles internos.
- **Controller (`*.controller.js`):** extrae parámetros (`req.params`, `req.query`, `req.body`, `req.auth`), delega al servicio y devuelve el código HTTP y payload correspondientes.
- **Service (`*.service.js`):** concentra reglas de negocio, validaciones de entrada, control de transiciones de estado, cálculo de disponibilidad, coordinación de transacciones y generación de notificaciones.
- **Repository (`backend/src/database/mongodb/repositories/*.repository.js`):** encapsula exclusivamente el acceso a colecciones MongoDB, exige `organizationId` en cada operación (`requireOrganizationId`), propaga `session` transaccional y proyecta únicamente los campos necesarios.
- **MongoDB (`rs0`):** persistencia documental exclusiva con índices únicos compuestos por `organizationId` y soporte de transacciones ACID multi-documento.

---

## 2. Seguridad, identidad y aislamiento

- **JWT (`jsonwebtoken`):** al autenticarse en `POST /api/v1/auth/login` con `organizationSlug`, `email` y `password`, el backend valida la contraseña hasheada y emite un JWT con `userId`, `organizationId` y `role`.
- **RBAC:** cada ruta declara explícitamente los roles permitidos (por ejemplo, `GET /api/v1/clients` y `GET /api/v1/professionals` permanecen restringidos a `ADMIN` y `RECEPTIONIST`).
- **Aislamiento multi-tenant (`organizationId`):** todas las consultas, actualizaciones y borrados lógicos incluyen `organizationId` en el filtro de repositorio. Los intentos cross-tenant responden `404` sin revelar la existencia de recursos ajenos.
- **Identidad self-scoped (`/api/v1/me/...`):** los portales `CLIENT` y `PROFESSIONAL` resuelven su identidad (`clientId` o `professionalId`) desde `req.auth.userId` en el servidor, ignorando cualquier identificador externo que el cliente HTTP intente enviar. El enriquecimiento de nombres (`clientName` en agenda del profesional y `professionalName` en citas del cliente) se realiza con consultas agrupadas (`$in`) acotadas por `organizationId` y proyección mínima `{ _id: 0, id: 1, name: 1 }`.

---

## 3. Disponibilidad, solapamiento y concurrencia

- **Cálculo de disponibilidad (`availability.service.js`):**
  1. Verifica servicio activo y profesionales activos asignados al servicio (o el profesional específico solicitado).
  2. Obtiene los bloques de `weeklySchedules` del día de la semana correspondiente.
  3. Genera candidatos en intervalos de 30 minutos garantizando que `candidateStart + serviceDurationMinutes <= scheduleEnd` (evitando exceder la jornada o cruzar descansos).
  4. Excluye cualquier candidato que se solape con `availabilityBlocks` (incluidos bloqueos multi-día) o con citas en estado activo (`PROGRAMADA`, `CONFIRMADA`).
- **Regla de solapamiento (intervalos semiabiertos):** dos intervalos `[A_start, A_end)` y `[B_start, B_end)` se solapan si y solo si `A_start < B_end && A_end > B_start`. Por lo tanto, citas, horarios y bloqueos **adyacentes/consecutivos** (`end === start`) están permitidos.
- **Day Locks (`professionalDayLocks`) y Transacciones (`withDayLockTransaction`):**
  - Toda operación que crea, reprograma o edita el profesional/duración de una cita ejecuta una transacción MongoDB (`withTransaction`) y adquiere previamente un bloqueo lógico por `(organizationId, professionalId, date)` en la colección `professionalDayLocks` (si involucra dos días o dos profesionales, adquiere los locks en orden determinista para evitar deadlocks).
  - Ante contención por `E11000` en el índice único del lock o errores transitorios de transacción, se aplica reintento acotado, garantizando que dos solicitudes simultáneas sobre el mismo slot resulten exactamente en `1x201` (o `1x200`) y `1x409`.

---

## 4. Ciclo de vida de citas, snapshots y notificaciones

- **Estados de cita:**
  - Activos: `PROGRAMADA` (estado inicial y estado tras reprogramar) y `CONFIRMADA`.
  - Terminales: `CANCELADA`, `COMPLETADA` y `NO_ASISTIO`.
  - Las transiciones a `COMPLETADA` y `NO_ASISTIO` verifican que la cita haya finalizado (`now >= endAt` mediante `assertAppointmentHasEndedAt`).
  - Confirmar una cita ya `CONFIRMADA` o cancelar una cita ya `CANCELADA` son operaciones idempotentes (`200` sin duplicar notificaciones ni modificar `updatedAt`).
- **Snapshots de servicio:** cada cita almacena `serviceDurationMinutes` y `servicePriceMinorUnits` (en unidades menores enteras) al crearse o editarse el servicio, preservando consistencia histórica aunque el catálogo cambie después.
- **Notificaciones internas (`notification.service.js`):** se insertan dentro de la misma transacción de la cita (atomicidad garantizada: si falla la cita, no se persiste ninguna notificación). Los tipos emitidos cubren `APPOINTMENT_CREATED`, `APPOINTMENT_ASSIGNED`, `APPOINTMENT_CONFIRMED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`, `APPOINTMENT_UPDATED` y `APPOINTMENT_REASSIGNED`, iniciando con `isRead: false` y `readAt: null`.
