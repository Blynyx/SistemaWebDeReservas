import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  closeMongo,
  connectMongo,
  getMongoClient,
  getMongoDb,
} from '../src/database/mongodb/client.js';
import { ensureIndexes, INDEX_DEFINITIONS } from '../src/database/mongodb/indexes.js';
import {
  DEFAULT_TRANSACTION_OPTIONS,
  withTransaction,
} from '../src/database/mongodb/transaction.js';

function createMockClient({ failConnect = false, connectDelayMs = 0 } = {}) {
  let connectCount = 0;
  let closeCount = 0;
  const dbMap = new Map();

  const client = {
    async connect() {
      connectCount += 1;
      if (connectDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, connectDelayMs));
      }
      if (failConnect) {
        throw new Error('connect ECONNREFUSED mongodb://user:secret@127.0.0.1:27017');
      }
    },
    db(name) {
      if (!dbMap.has(name)) {
        dbMap.set(name, { databaseName: name });
      }
      return dbMap.get(name);
    },
    async close() {
      closeCount += 1;
    },
    get stats() {
      return { connectCount, closeCount };
    },
  };

  return client;
}

describe('MongoDB Infrastructure (Unit)', () => {
  afterEach(async () => {
    await closeMongo();
  });

  it('connecta correctamente, selecciona MONGODB_DB_NAME y mantiene singleton', async () => {
    const mockClient = createMockClient();
    const factoryCalls = [];

    const first = await connectMongo({
      uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
      dbName: 'reservas_test',
      clientFactory: (uri) => {
        factoryCalls.push(uri);
        return mockClient;
      },
    });

    const second = await connectMongo({
      uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
      dbName: 'reservas_test',
      clientFactory: () => {
        throw new Error('No debe crear un segundo cliente');
      },
    });

    assert.equal(factoryCalls.length, 1);
    assert.equal(mockClient.stats.connectCount, 1);
    assert.equal(first.client, second.client);
    assert.equal(getMongoClient(), mockClient);
    assert.equal(getMongoDb().databaseName, 'reservas_test');
  });

  it('previene múltiples conexiones simultáneas cuando connectMongo se invoca en paralelo', async () => {
    const mockClient = createMockClient({ connectDelayMs: 25 });
    let factoryCount = 0;

    const [a, b] = await Promise.all([
      connectMongo({
        uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
        dbName: 'reservas',
        clientFactory: () => {
          factoryCount += 1;
          return mockClient;
        },
      }),
      connectMongo({
        uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
        dbName: 'reservas',
        clientFactory: () => {
          factoryCount += 1;
          return mockClient;
        },
      }),
    ]);

    assert.equal(factoryCount, 1);
    assert.equal(mockClient.stats.connectCount, 1);
    assert.equal(a.db, b.db);
  });

  it('cierra el cliente correctamente con closeMongo y limpia el estado', async () => {
    const mockClient = createMockClient();
    await connectMongo({
      uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0',
      dbName: 'reservas',
      clientFactory: () => mockClient,
    });

    await closeMongo();
    assert.equal(mockClient.stats.closeCount, 1);
    assert.throws(() => getMongoDb(), /no está inicializada/);
    assert.throws(() => getMongoClient(), /no está inicializado/);
  });

  it('lanza error de configuración si falta MONGODB_URI o MONGODB_DB_NAME', async () => {
    await assert.rejects(
      () => connectMongo({ uri: '', dbName: 'reservas' }),
      /MONGODB_URI es obligatoria/
    );
    await assert.rejects(
      () => connectMongo({ uri: 'mongodb://127.0.0.1:27017/?replicaSet=rs0', dbName: '' }),
      /MONGODB_DB_NAME es obligatoria/
    );
  });

  it('sanitiza credenciales si falla la conexión', async () => {
    const mockClient = createMockClient({ failConnect: true });

    await assert.rejects(
      () =>
        connectMongo({
          uri: 'mongodb://user:secret@127.0.0.1:27017/?replicaSet=rs0',
          dbName: 'reservas',
          clientFactory: () => mockClient,
        }),
      (err) => {
        assert.match(err.message, /No se pudo conectar a MongoDB/);
        assert.ok(!err.message.includes('secret'));
        assert.equal(mockClient.stats.closeCount, 1);
        return true;
      }
    );
  });

  it('ensureIndexes crea todos los índices especificados, es idempotente y respeta aislamiento tenant', async () => {
    const calls = new Map();
    const fakeDb = {
      collection(name) {
        return {
          async createIndexes(specs) {
            if (!calls.has(name)) {
              calls.set(name, specs);
            }
            return specs.map((s) => s.name);
          },
        };
      },
    };

    const first = await ensureIndexes(fakeDb);
    const second = await ensureIndexes(fakeDb);

    assert.equal(first.length, INDEX_DEFINITIONS.length);
    assert.equal(second.length, INDEX_DEFINITIONS.length);

    const userAccountIndexes = calls.get('userAccounts');
    assert.ok(userAccountIndexes.some((i) => i.name === 'ux_user_accounts_org_id' && i.unique));
    assert.ok(userAccountIndexes.some((i) => i.name === 'ux_user_accounts_org_email' && i.unique));
    assert.equal(
      userAccountIndexes.some((i) => Object.keys(i.key).length === 1 && i.key.id === 1),
      false,
      'userAccounts no debe tener índice global { id: 1 }'
    );

    const lockIndexes = calls.get('professionalDayLocks');
    assert.ok(
      lockIndexes.some(
        (i) =>
          i.unique &&
          i.key.organizationId === 1 &&
          i.key.professionalId === 1 &&
          i.key.date === 1
      )
    );
  });

  it('withTransaction propaga session, devuelve resultado y cierra session en finally', async () => {
    const events = [];
    const fakeSession = {
      async withTransaction(fn, opts) {
        events.push({ type: 'start', opts });
        return fn();
      },
      async endSession() {
        events.push({ type: 'end' });
      },
    };
    const fakeClient = {
      startSession() {
        return fakeSession;
      },
    };

    const result = await withTransaction(
      async (session) => {
        assert.equal(session, fakeSession);
        return { ok: true };
      },
      { client: fakeClient }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(events[0], { type: 'start', opts: DEFAULT_TRANSACTION_OPTIONS });
    assert.deepEqual(events[1], { type: 'end' });
  });

  it('withTransaction propaga errores y cierra session incluso cuando falla', async () => {
    let ended = false;
    const fakeSession = {
      async withTransaction(fn) {
        return fn();
      },
      async endSession() {
        ended = true;
      },
    };
    const fakeClient = {
      startSession() {
        return fakeSession;
      },
    };

    await assert.rejects(
      () =>
        withTransaction(
          async () => {
            throw new Error('boom');
          },
          { client: fakeClient }
        ),
      /boom/
    );

    assert.equal(ended, true);
  });
});
