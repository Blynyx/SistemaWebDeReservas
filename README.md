# Sistema Web de Reservas de Citas

Aplicación web full-stack multi-tenant para la gestión integral de reservas de citas en organizaciones de servicios (clínicas, consultorios, centros de atención o estudios profesionales), desarrollada sobre el stack **MERN** (**MongoDB**, **Express**, **React**, **Node.js**) siguiendo metodología Ágil + Spec-Driven Development (SDD).

> **Nota de entorno:** Este proyecto está preparado para ejecución y evaluación **local** (no se afirma despliegue en producción en la nube).

---

## 1. Problema y objetivo del sistema

### Problema
Las organizaciones que gestionan citas manualmente suelen enfrentar choques de horario, reservas concurrentes sobre el mismo bloque, desactualización de disponibilidad ante bloqueos o cancelaciones, falta de trazabilidad del ciclo de vida de cada cita y ausencia de vistas separadas por rol.

### Objetivo
Ofrecer una plataforma web segura, multi-tenant y transaccional que permita:
- Calcular disponibilidad real en función de horarios semanales, bloqueos excepcionales y citas activas.
- Evitar dobles reservas concurrentes mediante bloqueos diarios (`professionalDayLocks`) y transacciones ACID en MongoDB Replica Set.
- Separar la operación por portales dedicados para **ADMIN**, **RECEPTIONIST**, **PROFESSIONAL** y **CLIENT**.
- Garantizar trazabilidad de aceptación sobre **13 Historias de Usuario / 52 criterios oficiales (52/52 PASS)**.

---

## 2. Características principales

- **Multi-tenant estricto (`organizationId`):** aislamiento de datos por organización desde el onboarding hasta las consultas de repositorio e índices MongoDB.
- **Autenticación JWT y RBAC + identidad self-scoped (`/api/v1/me/...`):** cada usuario opera únicamente dentro de su organización y rol.
- **Motor de disponibilidad real:** considera servicios activos asignados al profesional, bloques semanales (incluidos bloques separados por descanso o contiguos), bloqueos excepcionales (simples y multi-día) y citas activas (`PROGRAMADA`, `CONFIRMADA`).
- **Ciclo de vida completo de citas:** registrar, editar datos operativos (`ADMIN`/`RECEPTIONIST`), confirmar, reprogramar, cancelar, completar (`COMPLETADA`) y marcar inasistencia (`NO_ASISTIO`), con snapshots de duración y precio del servicio.
- **Agenda interactiva (FullCalendar):** vista de día, semana y mes para el rol `PROFESSIONAL`, mostrando nombre legible del cliente sin abrir `/api/v1/clients`.
- **Dashboard analítico (Chart.js):** conteos operativos por fecha/estado, servicios más solicitados (`topServices`) y clientes frecuentes (`frequentClients`).
- **Notificaciones internas:** generación atómica de avisos por eventos de cita para `CLIENT` y `PROFESSIONAL`, con filtros `read`/`unread` y marcado de lectura idempotente (`readAt`).

---

## 3. Stack tecnológico (MERN)

- **Base de datos:** MongoDB `8.0` (imagen Docker oficial `mongo:8.0`) en modo **Replica Set `rs0`** para soporte de transacciones multi-documento, utilizando el driver oficial `mongodb` (`^7.9.1`).
- **Backend:** Node.js (ESM) + Express (`^5.1.0`), `jsonwebtoken`, `cors`, `dotenv`, pruebas con `node:test`.
- **Frontend:** React (`^19.3.1`), React Router (`^7.18.6`), Vite (`^7.1.7`), FullCalendar (`@fullcalendar/react`), Chart.js (`chart.js` + `react-chartjs-2`), Day.js.

### Nota histórica sobre MongoDB y cambio de requisito
La consigna original del proyecto contemplaba SQLite como base de datos. Posteriormente, por indicación del docente, la persistencia fue migrada íntegramente a **MongoDB**. La arquitectura actual utiliza **MongoDB como persistencia exclusiva** (sin SQLite), con driver oficial de Node.js, Replica Set `rs0`, transacciones ACID, UUIDs como identificadores públicos y `organizationId` como clave de aislamiento multi-tenant. Véase [docs/specs/mongodb-migration-spec.md](docs/specs/mongodb-migration-spec.md).

---

## 4. Arquitectura

El sistema sigue una arquitectura en capas **Controller → Service → Repository**:

```text
React (SPA) → REST API (/api/v1) → Middleware (JWT / RBAC / Error) → Controller → Service → Repository → MongoDB (Replica Set rs0)
```

El detalle completo de responsabilidades por capa, JWT, RBAC, multi-tenant, cálculo de disponibilidad, `professionalDayLocks`, transacciones, estados de citas, snapshots y notificaciones se encuentra en [docs/architecture/architecture-overview.md](docs/architecture/architecture-overview.md).

---

## 5. Roles disponibles

| Rol | Alcance principal |
| --- | --- |
| `ADMIN` | Onboarding, dashboard KPIs, CRUD de servicios, profesionales (servicios/horarios/cuentas), clientes (cuentas), cuentas `RECEPTIONIST` y gestión completa de citas (crear, editar, confirmar, reprogramar, cancelar). |
| `RECEPTIONIST` | Dashboard operativo, gestión de clientes, consulta de profesionales/servicios y gestión completa de citas (crear, editar, confirmar, reprogramar, cancelar). |
| `PROFESSIONAL` | Portal propio: agenda interactiva día/semana/mes (`/agenda`) con nombre de cliente, registro de `COMPLETADA`/`NO_ASISTIO`, bloqueos excepcionales (`/bloqueos`) y bandeja de notificaciones (`/notificaciones`). |
| `CLIENT` | Portal propio: consulta de disponibilidad y reserva online (`/reservar`), gestión de sus citas con nombre del profesional (`/mis-citas`: reprogramar y cancelar) y bandeja de notificaciones (`/notificaciones`). |

---

## 6. Requisitos de instalación

- **Node.js** y **npm** (entorno verificado localmente: Node `v24.16.0`, npm `11.13.0`; no se afirma que esa sea la versión mínima soportada).
- **Docker** y **Docker Compose** para levantar MongoDB 8.0 en modo Replica Set `rs0` (entorno verificado localmente: Docker `29.8.0`, Docker Compose `v5.5.1`).
- Alternativamente, una instancia local de MongoDB 8.0 configurada con `--replSet rs0` en `127.0.0.1:27017`.

---

## 7. Variables de entorno

### Backend (`backend/.env`)
Copiar desde `backend/.env.example`:

| Variable | Valor de ejemplo (desarrollo local) | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP del servidor Express. |
| `JWT_SECRET` | `change-me` | Secreto para firmar tokens JWT (usar un valor propio en local; nunca subir secretos reales al repositorio). |
| `JWT_EXPIRES_IN` | `2h` | Tiempo de expiración de sesión JWT. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/?replicaSet=rs0` | URI de conexión al Replica Set MongoDB. |
| `MONGODB_DB_NAME` | `reservas` | Nombre de la base de datos MongoDB. |

### Frontend (`frontend/.env`)
Copiar desde `frontend/.env.example`:

| Variable | Valor de ejemplo (desarrollo local) | Descripción |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | URL base de la API REST del backend. |

---

## 8. Instalación y ejecución desde un clon limpio

### Paso 1: Levantar MongoDB 8.0 (Replica Set `rs0`)
Desde la raíz del repositorio:

```powershell
docker compose -f docker-compose.mongo.yml up -d
```

### Paso 2: Configurar variables de entorno
```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```
*(Opcional: editar `JWT_SECRET` en `backend/.env` con un valor local de desarrollo).*

### Paso 3: Instalar dependencias (usando lockfiles)
```powershell
cd backend
npm ci

cd ..\frontend
npm ci
cd ..
```

### Paso 4: Inicializar Replica Set, verificar conexión, índices y seed demo
Desde `backend/`:

```powershell
cd backend
npm run mongo:rs:init
npm run mongo:check
npm run mongo:indexes
npm run mongo:seed
```

- `npm run mongo:rs:init`: inicializa el Replica Set `rs0` de forma idempotente y verifica que el nodo esté en estado `PRIMARY`.
- `npm run mongo:check`: confirma conectividad y soporte de transacciones en `rs0`.
- `npm run mongo:indexes`: crea de forma idempotente todos los índices multi-tenant y de concurrencia.
- `npm run mongo:seed`: crea la organización demo `demo-reservas`, 1 servicio (`Consulta General`, 60 min), 1 profesional (`Ana Torres`) con horarios lunes a viernes `09:00–13:00`, 1 cliente (`Cliente Demo`) y 4 cuentas de demostración (`ADMIN`, `RECEPTIONIST`, `PROFESSIONAL`, `CLIENT`), sin crear citas en fechas fijas. Re-ejecutarlo es completamente idempotente.

Para más detalles operativos de MongoDB, consultar [docs/ops/mongodb-local-setup.md](docs/ops/mongodb-local-setup.md).

### Paso 5: Ejecutar backend y frontend en local

En una terminal (backend):
```powershell
cd backend
npm start
```
*(O `npm run dev` para recarga automática con `nodemon`).*

En otra terminal (frontend):
```powershell
cd frontend
npm run dev
```

### URLs locales
- **Frontend (React + Vite):** `http://localhost:5173`
- **Backend API:** `http://localhost:3000/api/v1`
- **Health check:** `http://localhost:3000/api/health`

---

## 9. Credenciales exclusivamente de demostración

Creadas por `npm run mongo:seed` sobre la organización **`demo-reservas`** (solo para pruebas locales):

| Rol | Organización (slug) | Correo | Contraseña |
| --- | --- | --- | --- |
| `ADMIN` | `demo-reservas` | `admin@demo.local` | `Admin123!` |
| `RECEPTIONIST` | `demo-reservas` | `recepcion@demo.local` | `Recepcion123!` |
| `PROFESSIONAL` | `demo-reservas` | `profesional@demo.local` | `Profesional123!` |
| `CLIENT` | `demo-reservas` | `cliente@demo.local` | `Cliente123!` |

---

## 10. Pruebas automatizadas y compilación

### Pruebas del backend
Requieren MongoDB Replica Set `rs0` en ejecución (las suites crean y eliminan sus propias bases de datos de prueba aisladas sin modificar `reservas`):

```powershell
cd backend
npm test
```

### Compilación de producción del frontend
```powershell
cd frontend
npm run build
```

---

## 11. Documentación SDD y técnica

- [docs/sdd/acceptance-evidence.md](docs/sdd/acceptance-evidence.md) — Matriz oficial de trazabilidad de los **52/52 criterios** (`13/13 HU = CUMPLE 4/4`).
- [docs/architecture/architecture-overview.md](docs/architecture/architecture-overview.md) — Arquitectura en capas, seguridad, concurrencia y reglas de dominio.
- [docs/specs/mongodb-migration-spec.md](docs/specs/mongodb-migration-spec.md) — Especificación de la migración a MongoDB Replica Set.
- [docs/ops/mongodb-local-setup.md](docs/ops/mongodb-local-setup.md) — Guía operativa de MongoDB local con Docker Compose.

---

## 12. Estructura principal del repositorio

```text
.
├── backend/
│   ├── src/
│   │   ├── app.js                     # Configuración Express, CORS, rutas y manejo de errores
│   │   ├── server.js                  # Arranque HTTP y conexión MongoDB
│   │   ├── config/                    # Carga y validación de variables de entorno
│   │   ├── database/mongodb/          # Cliente, transacciones, índices, repositorios y scripts
│   │   ├── middleware/                # Autenticación JWT, RBAC y error handler
│   │   ├── modules/                   # Módulos de dominio (auth, onboarding, services, professionals,
│   │   │                              # clients, receptionists, availability, availabilityBlocks,
│   │   │                              # weeklySchedules, appointments, notifications, dashboard, self)
│   │   └── utils/                     # Utilidades de fecha/hora, hashing y errores HTTP
│   ├── tests/                         # Suites automatizadas (node:test)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                       # Clientes HTTP hacia /api/v1
│   │   ├── components/                # Diálogos, tarjetas, listas, navegación y gráficos
│   │   ├── context/                   # Estado de sesión y autenticación
│   │   ├── pages/                     # Portales ADMIN, RECEPTIONIST, PROFESSIONAL y CLIENT
│   │   └── utils/                     # Formateo de fechas, montos, estados y mensajes seguros
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── architecture/                  # Visión general de arquitectura
│   ├── ops/                           # Guía operativa de MongoDB local
│   ├── sdd/                           # Evidencia de aceptación 52/52
│   └── specs/                         # Especificación de migración MongoDB
├── docker-compose.mongo.yml           # Contenedor MongoDB 8.0 Replica Set rs0
└── README.md
```

---

## 13. Limitaciones conocidas

- **Entorno local:** el sistema está verificado para ejecución local; no incluye despliegue cloud ni pipelines CI/CD en producción.
- **Notificaciones internas:** las notificaciones son internas dentro de la aplicación (no se envían correos electrónicos reales ni SMS).
- **Pagos y exportación:** no se incluyen pasarelas de pago ni exportación a PDF/Excel (fuera del alcance definido).
- **Regla de borde `now === endAt` (`TC-HU05-04`):** la igualdad exacta al minuto de finalización se verifica mediante prueba unitaria determinista de dominio (`assertAppointmentHasEndedAt`), complementada por pruebas HTTP de transición de estado.
- **Tamaño de bundle frontend:** Vite reporta advertencia informativa de chunk >500 kB al agrupar FullCalendar y Chart.js en un solo bundle (no afecta la funcionalidad ni el build).
