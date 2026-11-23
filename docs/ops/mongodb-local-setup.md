# Entorno Local MongoDB 8.0 (Replica Set `rs0`)

MongoDB 8.0 es la base de datos productiva actual del sistema **Sistema Web de Reservas de Citas**.

> **Obligatorio:** El sistema requiere un **Replica Set (`rs0`)** incluso en desarrollo local para ejecutar transacciones multi-documento (`withTransaction` / `withDayLockTransaction`). Una instancia standalone **no** es válida.

## Flujo recomendado de arranque (Windows PowerShell)

### 1. Iniciar MongoDB 8.0 con Docker

Desde la raíz del repositorio:

```powershell
docker compose -f docker-compose.mongo.yml up -d
```

Verificar estado del contenedor:

```powershell
docker compose -f docker-compose.mongo.yml ps
```

### 2. Inicializar el Replica Set `rs0` (primera vez)

Desde `backend/`:

```powershell
npm run mongo:rs:init
```

### 3. Configurar `.env`

Copiar `backend/.env.example` a `backend/.env` y ajustar los secretos locales:

```env
PORT=3000
JWT_SECRET=change-me
JWT_EXPIRES_IN=2h
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
MONGODB_DB_NAME=reservas
```

### 4. Verificar conexión y Replica Set

Desde `backend/`:

```powershell
npm run mongo:check
```

### 5. Asegurar índices

```powershell
npm run mongo:indexes
```

*(Nota: `npm start` también ejecuta `ensureIndexes()` automáticamente al iniciar).*

### 6. Cargar datos demo (opcional, idempotente)

```powershell
npm run mongo:seed
```

Crea la organización `demo-reservas` (`admin@demo.local`, `profesional@demo.local`, `cliente@demo.local`) sin eliminar ni duplicar datos existentes.

### 7. Iniciar el backend

```powershell
npm start
```

### 8. Comprobar Health

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/health -UseBasicParsing
```

Esperado: `200 OK` con `{"status":"ok"}`.

## Detener el entorno

Manteniendo los datos persistidos en el volumen Docker:

```powershell
docker compose -f docker-compose.mongo.yml down
```

Eliminando también el volumen de datos locales:

```powershell
docker compose -f docker-compose.mongo.yml down -v
```
