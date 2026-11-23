import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { closeMongo, connectMongo, getMongoDb } from '../src/database/mongodb/client.js';
import { ensureIndexes } from '../src/database/mongodb/indexes.js';
import { DEMO_SEED_CONFIG, seedDemoData } from '../src/database/mongodb/scripts/seedDemo.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_seed_26f_test';

describe('MongoDB Demo Seed (Etapa 26F)', () => {
  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());
  });

  after(async () => {
    await getMongoDb().dropDatabase().catch(() => {});
    await closeMongo();
  });

  it('crea datos demo reproducibles en la primera ejecución y es idempotente en la segunda', async () => {
    const first = await seedDemoData();
    assert.equal(first.skipped, false);
    assert.equal(first.organizationSlug, DEMO_SEED_CONFIG.organizationSlug);

    const db = getMongoDb();
    assert.equal(await db.collection('organizations').countDocuments({ slug: 'demo-reservas' }), 1);
    assert.equal(await db.collection('userAccounts').countDocuments({}), 3);
    assert.equal(await db.collection('services').countDocuments({}), 1);
    assert.equal(await db.collection('professionals').countDocuments({}), 1);
    assert.equal(await db.collection('professionalServices').countDocuments({}), 1);
    assert.equal(await db.collection('weeklySchedules').countDocuments({}), 5);
    assert.equal(await db.collection('clients').countDocuments({}), 1);
    assert.equal(await db.collection('appointments').countDocuments({}), 0);

    const second = await seedDemoData();
    assert.equal(second.skipped, true);
    assert.equal(second.message, 'Datos demo ya existentes; no se duplicaron.');
    assert.equal(await db.collection('organizations').countDocuments({ slug: 'demo-reservas' }), 1);
    assert.equal(await db.collection('userAccounts').countDocuments({}), 3);
  });
});
