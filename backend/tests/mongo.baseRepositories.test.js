import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  closeMongo,
  connectMongo,
  getMongoDb,
} from '../src/database/mongodb/client.js';
import { ensureIndexes } from '../src/database/mongodb/indexes.js';
import { withTransaction } from '../src/database/mongodb/transaction.js';
import * as orgRepo from '../src/database/mongodb/repositories/organization.repository.js';
import * as userRepo from '../src/database/mongodb/repositories/userAccount.repository.js';
import * as serviceRepo from '../src/database/mongodb/repositories/service.repository.js';
import * as professionalRepo from '../src/database/mongodb/repositories/professional.repository.js';
import * as clientRepo from '../src/database/mongodb/repositories/client.repository.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = process.env.MONGODB_TEST_DB_NAME || 'reservas_repo_26c_test';

let mongoAvailable = false;
let skipReason = '';

describe('MongoDB Base Repositories (Etapa 26C)', () => {
  before(async () => {
    try {
      await connectMongo({
        uri: TEST_URI,
        dbName: TEST_DB_NAME,
        clientOptions: { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 },
      });
      const hello = await getMongoDb().admin().command({ hello: 1 });
      if (hello.setName !== 'rs0') {
        skipReason = `Replica Set requerido ('rs0'), encontrado '${hello.setName || 'standalone'}'`;
        await closeMongo();
        return;
      }
      await getMongoDb().dropDatabase();
      await ensureIndexes(getMongoDb());
      mongoAvailable = true;
    } catch (error) {
      skipReason = `MongoDB Replica Set no disponible: ${error.message}`;
      await closeMongo().catch(() => {});
    }
  });

  after(async () => {
    if (mongoAvailable) {
      await getMongoDb().dropDatabase().catch(() => {});
    }
    await closeMongo();
  });

  it('Organizations: insert, slugExists, findBySlug, findById, unicidad de slug y contrato legacy', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgId = randomUUID();
    await orgRepo.insertOrganization({ id: orgId, name: 'Clínica Alpha', slug: 'clinica-alpha' });

    assert.equal(await orgRepo.slugExists('clinica-alpha'), true);
    assert.equal(await orgRepo.slugExists('no-existe'), false);

    const bySlug = await orgRepo.findBySlug('clinica-alpha');
    assert.deepEqual(bySlug, {
      id: orgId,
      name: 'Clínica Alpha',
      slug: 'clinica-alpha',
      is_active: 1,
    });
    assert.equal('_id' in bySlug, false);

    const byId = await orgRepo.findById(orgId);
    assert.deepEqual(byId, bySlug);

    await assert.rejects(
      () => orgRepo.insertOrganization({ id: randomUUID(), name: 'Otra', slug: 'clinica-alpha' }),
      (err) => err.code === 11000
    );
  });

  it('UserAccounts: insert, lookups, unicidad (org+email), deactivate y adaptador legacy', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const userId = randomUUID();

    await userRepo.insertUserAccount({
      id: userId,
      organizationId: orgA,
      email: 'admin@orga.local',
      passwordHash: 'hashed-pw',
      role: 'ADMIN',
      isActive: 1,
    });

    // Mismo email permitido en otra organización (ORG-B)
    await userRepo.insertUserAccount({
      id: randomUUID(),
      organizationId: orgB,
      email: 'admin@orga.local',
      passwordHash: 'hashed-pw-b',
      role: 'ADMIN',
      isActive: 1,
    });

    // Email duplicado dentro de la misma organización falla por índice único
    await assert.rejects(
      () =>
        userRepo.insertUserAccount({
          id: randomUUID(),
          organizationId: orgA,
          email: 'admin@orga.local',
          passwordHash: 'x',
          role: 'RECEPTIONIST',
          isActive: 1,
        }),
      (err) => err.code === 11000
    );

    const rawDoc = await getMongoDb().collection('userAccounts').findOne({ organizationId: orgA, id: userId });
    assert.equal(rawDoc.isActive, true);

    const byId = await userRepo.findByIdAndOrganization(userId, orgA);
    assert.deepEqual(byId, {
      id: userId,
      organization_id: orgA,
      email: 'admin@orga.local',
      role: 'ADMIN',
      is_active: 1,
    });
    assert.equal('password_hash' in byId, false);

    const byEmail = await userRepo.findByOrganizationIdAndEmail(orgA, 'admin@orga.local');
    assert.equal(byEmail.password_hash, 'hashed-pw');

    // Aislamiento multi-tenant: ORG-B no ve usuario de ORG-A
    assert.equal(await userRepo.findByIdAndOrganization(userId, orgB), null);

    await userRepo.deactivate(orgA, userId);
    const deactivated = await userRepo.findByIdAndOrganization(userId, orgA);
    assert.equal(deactivated.is_active, 0);
  });

  it('Services: insert, list ordenado, update, deactivate, dinero entero y aislamiento multi-tenant', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const svc1 = randomUUID();
    const svc2 = randomUUID();
    const svcB = randomUUID();

    await serviceRepo.insertService({
      id: svc1,
      organizationId: orgA,
      name: 'Zumba Terapéutica',
      description: null,
      durationMinutes: 45,
      priceMinorUnits: 3500,
    });
    await serviceRepo.insertService({
      id: svc2,
      organizationId: orgA,
      name: 'Consulta General',
      description: 'Evaluación inicial',
      durationMinutes: 30,
      priceMinorUnits: 5000,
    });
    await serviceRepo.insertService({
      id: svcB,
      organizationId: orgB,
      name: 'Servicio B',
      description: null,
      durationMinutes: 60,
      priceMinorUnits: 8000,
    });

    const listA = await serviceRepo.findAllByOrganization(orgA);
    assert.equal(listA.length, 2);
    assert.equal(listA[0].name, 'Consulta General');
    assert.equal(listA[1].name, 'Zumba Terapéutica');
    assert.equal(listA[0].duration_minutes, 30);
    assert.equal(listA[0].price_minor_units, 5000);
    assert.equal(listA[0].is_active, 1);
    assert.ok(typeof listA[0].created_at === 'string');

    await serviceRepo.updateService(orgA, svc1, {
      priceMinorUnits: 4000,
      updatedAt: '2026-11-23T10:00:00.000Z',
    });
    const updated = await serviceRepo.findById(orgA, svc1);
    assert.equal(updated.price_minor_units, 4000);
    assert.equal(updated.updated_at, '2026-11-23T10:00:00.000Z');

    await serviceRepo.deactivateService(orgA, svc1, '2026-11-23T10:05:00.000Z');
    assert.equal((await serviceRepo.findById(orgA, svc1)).is_active, 0);

    // Multi-tenant: ORG-A no ve svcB
    assert.equal(await serviceRepo.findById(orgA, svcB), null);
    await assert.rejects(() => serviceRepo.findById('', svc1), /organizationId es obligatorio/);
  });

  it('Professionals y Clients: CRUD, linkUserAccount, partial uniqueness, adaptador legacy y aislamiento', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const pro1 = randomUUID();
    const pro2 = randomUUID();
    const cli1 = randomUUID();
    const cli2 = randomUUID();
    const uaPro = randomUUID();
    const uaCli = randomUUID();

    // Dos profesionales con userAccountId: null permitidos por índice parcial
    await professionalRepo.insertProfessional({
      id: pro1,
      organizationId: orgA,
      name: 'Dra. Ana',
      email: 'ana@orga.local',
      phone: '999111222',
    });
    await professionalRepo.insertProfessional({
      id: pro2,
      organizationId: orgA,
      name: 'Dr. Luis',
      email: null,
      phone: null,
    });

    await professionalRepo.linkUserAccount(orgA, pro1, uaPro, '2026-11-23T10:00:00.000Z');
    const linkedPro = await professionalRepo.findByUserAccountId(orgA, uaPro);
    assert.equal(linkedPro.id, pro1);
    assert.equal(linkedPro.user_account_id, uaPro);
    assert.equal(linkedPro.is_active, 1);

    // Verificar que el documento Mongo real almacena camelCase y boolean
    const rawPro = await getMongoDb().collection('professionals').findOne({ organizationId: orgA, id: pro1 });
    assert.equal(rawPro.isActive, true);
    assert.equal(rawPro.organizationId, orgA);
    assert.equal(rawPro.userAccountId, uaPro);

    // Vincular mismo userAccountId a otro profesional de la misma org falla por índice único parcial
    await assert.rejects(
      () => professionalRepo.linkUserAccount(orgA, pro2, uaPro, '2026-11-23T10:01:00.000Z'),
      (err) => err.code === 11000
    );

    // Aislamiento ORG-B
    assert.equal(await professionalRepo.findById(orgB, pro1), null);
    assert.equal(await professionalRepo.findByUserAccountId(orgB, uaPro), null);

    // Clients: dos con null, linkUserAccount, partial uniqueness, update, deactivate
    await clientRepo.insertClient({
      id: cli1,
      organizationId: orgA,
      name: 'Carlos Pérez',
      email: 'carlos@orga.local',
      phone: '988777666',
    });
    await clientRepo.insertClient({
      id: cli2,
      organizationId: orgA,
      name: 'Beatriz Solís',
      email: null,
      phone: null,
    });

    await clientRepo.linkUserAccount(orgA, cli1, uaCli, '2026-11-23T10:02:00.000Z');
    const linkedCli = await clientRepo.findByUserAccountId(orgA, uaCli);
    assert.equal(linkedCli.id, cli1);
    assert.equal(linkedCli.user_account_id, uaCli);
    assert.equal(linkedCli.is_active, 1);
    assert.ok(typeof linkedCli.created_at === 'string');
    assert.equal(linkedCli.updated_at, '2026-11-23T10:02:00.000Z');

    await assert.rejects(
      () => clientRepo.linkUserAccount(orgA, cli2, uaCli, '2026-11-23T10:03:00.000Z'),
      (err) => err.code === 11000
    );

    await clientRepo.updateClient(orgA, cli1, { name: 'Carlos Pérez Jr.', updatedAt: '2026-11-23T10:04:00.000Z' });
    assert.equal((await clientRepo.findById(orgA, cli1)).name, 'Carlos Pérez Jr.');

    await clientRepo.deactivateClient(orgA, cli1, '2026-11-23T10:05:00.000Z');
    assert.equal((await clientRepo.findById(orgA, cli1)).is_active, 0);
    assert.equal(await clientRepo.findById(orgB, cli1), null);
  });

  it('Session propagation: commit y rollback transaccional con withTransaction en repositories', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgId = randomUUID();
    const userId = randomUUID();
    const slug = `tx-org-${orgId.slice(0, 8)}`;

    await withTransaction(async (session) => {
      await orgRepo.insertOrganization({ id: orgId, name: 'Tx Org', slug }, { session });
      await userRepo.insertUserAccount(
        {
          id: userId,
          organizationId: orgId,
          email: 'tx@org.local',
          passwordHash: 'hash',
          role: 'ADMIN',
          isActive: 1,
        },
        { session }
      );

      const inTxOrg = await orgRepo.findById(orgId, { session });
      assert.equal(inTxOrg.id, orgId);
    });

    assert.equal((await orgRepo.findById(orgId)).slug, slug);
    assert.equal((await userRepo.findByIdAndOrganization(userId, orgId)).email, 'tx@org.local');

    // Rollback: si falla la segunda operación, la primera no queda persistida
    const failOrgId = randomUUID();
    await assert.rejects(
      () =>
        withTransaction(async (session) => {
          await orgRepo.insertOrganization(
            { id: failOrgId, name: 'Rollback Org', slug: `rb-${failOrgId.slice(0, 8)}` },
            { session }
          );
          throw new Error('Abortar transacción');
        }),
      /Abortar transacción/
    );

    assert.equal(await orgRepo.findById(failOrgId), null);
  });
});
