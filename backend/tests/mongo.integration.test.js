import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  closeMongo,
  connectMongo,
  getMongoDb,
} from '../src/database/mongodb/client.js';
import { ensureIndexes } from '../src/database/mongodb/indexes.js';
import { withTransaction } from '../src/database/mongodb/transaction.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = process.env.MONGODB_TEST_DB_NAME || 'reservas_infra_test';

let mongoAvailable = false;
let skipReason = '';

describe('MongoDB Replica Set Integration (Live)', () => {
  before(async () => {
    try {
      await connectMongo({
        uri: TEST_URI,
        dbName: TEST_DB_NAME,
        clientOptions: { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 },
      });
      const hello = await getMongoDb().admin().command({ hello: 1 });
      if (hello.setName !== 'rs0') {
        skipReason = `MongoDB conectado pero Replica Set es '${hello.setName || 'standalone'}' en lugar de 'rs0'`;
        await closeMongo();
        return;
      }
      mongoAvailable = true;
    } catch (error) {
      skipReason = `MongoDB Replica Set no disponible en entorno actual: ${error.message}`;
      await closeMongo().catch(() => {});
    }
  });

  after(async () => {
    if (mongoAvailable) {
      await getMongoDb().dropDatabase().catch(() => {});
    }
    await closeMongo();
  });

  it('confirma Replica Set rs0, crea índices idempotentes y ejecuta transacción con commit y rollback', async (t) => {
    if (!mongoAvailable) {
      t.skip(skipReason);
      return;
    }

    const db = getMongoDb();
    const hello = await db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'rs0');

    await ensureIndexes(db);
    await ensureIndexes(db);

    const orgIndexes = await db.collection('organizations').indexes();
    assert.ok(orgIndexes.some((idx) => idx.name === 'ux_organizations_slug' && idx.unique));

    const testCol = db.collection('_tx_probe');
    await withTransaction(async (session) => {
      await testCol.insertOne({ marker: 'committed' }, { session });
    });
    assert.equal(await testCol.countDocuments({ marker: 'committed' }), 1);

    await assert.rejects(() =>
      withTransaction(async (session) => {
        await testCol.insertOne({ marker: 'rolled_back' }, { session });
        throw new Error('force rollback');
      })
    );
    assert.equal(await testCol.countDocuments({ marker: 'rolled_back' }), 0);
  });
});
