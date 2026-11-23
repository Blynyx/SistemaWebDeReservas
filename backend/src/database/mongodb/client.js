import { MongoClient } from 'mongodb';
import { MONGODB_DB_NAME, MONGODB_URI } from '../../config/env.js';

let client = null;
let db = null;
let connectPromise = null;

function sanitizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\/\/[^/@\s]+@/, '//***:***@');
}

function resolveConfig({ uri, dbName } = {}) {
  const resolvedUri = typeof uri === 'string' ? uri.trim() : MONGODB_URI.trim();
  const resolvedDbName = typeof dbName === 'string' ? dbName.trim() : MONGODB_DB_NAME.trim();

  if (!resolvedUri) {
    throw new Error('La variable de entorno MONGODB_URI es obligatoria para conectar a MongoDB');
  }

  if (!resolvedDbName) {
    throw new Error('La variable de entorno MONGODB_DB_NAME es obligatoria para seleccionar la base MongoDB');
  }

  return { resolvedUri, resolvedDbName };
}

/**
 * Conecta el singleton de MongoClient y selecciona la base de datos configurada.
 * Previene múltiples conexiones simultáneas reutilizando la promesa en curso.
 */
export async function connectMongo({
  uri,
  dbName,
  clientOptions = {},
  clientFactory = (u, opts) => new MongoClient(u, opts),
} = {}) {
  if (client && db) {
    return { client, db };
  }

  if (connectPromise) {
    return connectPromise;
  }

  const { resolvedUri, resolvedDbName } = resolveConfig({ uri, dbName });

  connectPromise = (async () => {
    const candidate = clientFactory(resolvedUri, clientOptions);
    try {
      await candidate.connect();
      const selectedDb = candidate.db(resolvedDbName);
      client = candidate;
      db = selectedDb;
      return { client, db };
    } catch (error) {
      await candidate.close().catch(() => {});
      throw new Error(`No se pudo conectar a MongoDB: ${sanitizeErrorMessage(error)}`);
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export function getMongoClient() {
  if (!client) {
    throw new Error('MongoClient no está inicializado. Ejecuta connectMongo() primero.');
  }
  return client;
}

export function getMongoDb() {
  if (!db) {
    throw new Error('La base de datos MongoDB no está inicializada. Ejecuta connectMongo() primero.');
  }
  return db;
}

export async function closeMongo() {
  if (connectPromise) {
    await connectPromise.catch(() => {});
  }

  const currentClient = client;
  client = null;
  db = null;
  connectPromise = null;

  if (currentClient) {
    await currentClient.close();
  }
}
