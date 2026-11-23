# Entorno Local MongoDB 8.0 (Replica Set `rs0`)

> Las transacciones multi-documento de MongoDB requieren un **Replica Set**. Una instancia standalone **no** es válida para este proyecto.

## 1. Iniciar MongoDB 8.0 (Windows PowerShell)

Desde la raíz del repositorio:

```powershell
docker compose -f docker-compose.mongo.yml up -d
```

Verificar que el contenedor esté saludable:

```powershell
docker compose -f docker-compose.mongo.yml ps
```

## 2. Inicializar el Replica Set `rs0`

Desde `backend/`:

```powershell
npm run mongo:rs:init
```

O manualmente con `mongosh` dentro del contenedor:

```powershell
docker exec -it reservas-mongodb-rs0 mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"
```

## 3. Comprobar que el Replica Set está configurado

```powershell
docker exec -it reservas-mongodb-rs0 mongosh --eval "rs.status().set; rs.isMaster().ismaster"
```

## 4. Conectarse y crear índices desde Node.js

Configurar `MONGODB_URI` y `MONGODB_DB_NAME` en `backend/.env` (ver `backend/.env.example`):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
MONGODB_DB_NAME=reservas
```

Luego, desde `backend/`:

```powershell
npm run mongo:check
npm run mongo:indexes
```

## 5. Detener el entorno

Detener manteniendo los datos persistidos en el volumen Docker:

```powershell
docker compose -f docker-compose.mongo.yml down
```

Detener y eliminar también el volumen de datos locales:

```powershell
docker compose -f docker-compose.mongo.yml down -v
```
