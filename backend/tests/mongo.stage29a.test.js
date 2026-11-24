import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-stage29a-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_stage_29a_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { default: app } = await import('../src/app.js');

describe('Etapa 29A — Dashboard KPIs (topServices/frequentClients) y Receptionists', () => {
  let server;
  let baseUrl;
  let orgA;
  let orgB;
  let adminHeadersA;
  let adminHeadersB;
  let proHeadersA;
  let clientHeadersA;

  async function api(path, { method = 'GET', headers, body } = {}) {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }

  async function login(slug, email, password) {
    return api('/auth/login', {
      method: 'POST',
      body: { organizationSlug: slug, email, password },
    });
  }

  async function mustPost(path, headers, body, expected = 201) {
    const res = await api(path, { method: 'POST', headers, body });
    assert.equal(res.status, expected, JSON.stringify(res.data));
    return res.data;
  }

  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    orgA = await mustPost('/onboarding/organizations', {}, {
      organizationName: 'Org 29A Alpha',
      adminEmail: 'admin-a29@test.local',
      adminPassword: 'Password123!',
    });
    const loginA = await login(orgA.organization.slug, 'admin-a29@test.local', 'Password123!');
    assert.equal(loginA.status, 200);
    adminHeadersA = { Authorization: `Bearer ${loginA.data.token}` };

    orgB = await mustPost('/onboarding/organizations', {}, {
      organizationName: 'Org 29A Beta',
      adminEmail: 'admin-b29@test.local',
      adminPassword: 'Password123!',
    });
    const loginB = await login(orgB.organization.slug, 'admin-b29@test.local', 'Password123!');
    assert.equal(loginB.status, 200);
    adminHeadersB = { Authorization: `Bearer ${loginB.data.token}` };

    // Crear 6 servicios y 6 clientes en Org A para validar orden y límite máximo 5
    const servicesA = [];
    for (let i = 1; i <= 6; i += 1) {
      servicesA.push(
        await mustPost('/services', adminHeadersA, {
          name: `Servicio A${i}`,
          durationMinutes: 30,
          priceMinorUnits: 1000 * i,
        })
      );
    }

    const clientsA = [];
    for (let i = 1; i <= 6; i += 1) {
      clientsA.push(
        await mustPost('/clients', adminHeadersA, {
          name: `Cliente A${i}`,
          email: `cli-a${i}@test.local`,
        })
      );
    }
    await mustPost(`/clients/${clientsA[0].id}/account`, adminHeadersA, {
      email: 'cli-a1@test.local',
      password: 'Password123!',
    });
    const loginCliA = await login(orgA.organization.slug, 'cli-a1@test.local', 'Password123!');
    clientHeadersA = { Authorization: `Bearer ${loginCliA.data.token}` };

    const proA = await mustPost('/professionals', adminHeadersA, {
      name: 'Prof A',
      email: 'prof-a29@test.local',
    });
    await mustPost(`/professionals/${proA.id}/account`, adminHeadersA, {
      email: 'prof-a29@test.local',
      password: 'Password123!',
    });
    const loginProA = await login(orgA.organization.slug, 'prof-a29@test.local', 'Password123!');
    proHeadersA = { Authorization: `Bearer ${loginProA.data.token}` };

    for (const svc of servicesA) {
      await mustPost(`/professionals/${proA.id}/services`, adminHeadersA, { serviceId: svc.id });
    }
    await mustPost(`/professionals/${proA.id}/schedules`, adminHeadersA, {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '20:00',
    });

    // Fecha lunes 2026-12-07:
    // Servicio 1 -> 3 citas (incluye 1 cancelada para verificar conteo histórico)
    // Servicio 2 -> 2 citas
    // Servicios 3, 4, 5, 6 -> 1 cita cada uno (total 6 servicios distintos -> topServices max 5)
    // Cliente 1 -> 3 citas, Cliente 2 -> 2 citas, Clientes 3..6 -> 1 cita cada uno
    const bookingsA = [
      { svc: servicesA[0], cli: clientsA[0], time: '08:00', cancel: true },
      { svc: servicesA[0], cli: clientsA[0], time: '08:30' },
      { svc: servicesA[0], cli: clientsA[0], time: '09:00' },
      { svc: servicesA[1], cli: clientsA[1], time: '09:30' },
      { svc: servicesA[1], cli: clientsA[1], time: '10:00' },
      { svc: servicesA[2], cli: clientsA[2], time: '10:30' },
      { svc: servicesA[3], cli: clientsA[3], time: '11:00' },
      { svc: servicesA[4], cli: clientsA[4], time: '11:30' },
      { svc: servicesA[5], cli: clientsA[5], time: '12:00' },
    ];

    for (const b of bookingsA) {
      const apt = await mustPost('/appointments', adminHeadersA, {
        clientId: b.cli.id,
        professionalId: proA.id,
        serviceId: b.svc.id,
        startAt: `2026-12-07T${b.time}`,
      });
      if (b.cancel) {
        const canceled = await api(`/appointments/${apt.id}/cancel`, {
          method: 'PATCH',
          headers: adminHeadersA,
        });
        assert.equal(canceled.status, 200);
      }
    }

    // Datos en Org B para la misma fecha 2026-12-07
    const svcB = await mustPost('/services', adminHeadersB, {
      name: 'Servicio B',
      durationMinutes: 60,
      priceMinorUnits: 9000,
    });
    const cliB = await mustPost('/clients', adminHeadersB, {
      name: 'Cliente B',
      email: 'cli-b@test.local',
    });
    const proB = await mustPost('/professionals', adminHeadersB, {
      name: 'Prof B',
      email: 'prof-b29@test.local',
    });
    await mustPost(`/professionals/${proB.id}/services`, adminHeadersB, { serviceId: svcB.id });
    await mustPost(`/professionals/${proB.id}/schedules`, adminHeadersB, {
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '18:00',
    });
    await mustPost('/appointments', adminHeadersB, {
      clientId: cliB.id,
      professionalId: proB.id,
      serviceId: svcB.id,
      startAt: '2026-12-07T09:00',
    });

    orgA.services = servicesA;
    orgA.clients = clientsA;
    orgB.serviceId = svcB.id;
    orgB.clientId = cliB.id;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await getMongoDb().dropDatabase().catch(() => {});
    await closeMongo();
  });

  it('DASH-29A: topServices y frequentClients ordenados, máximo 5, incluyen canceladas, tenant-scoped y 400 en fecha inválida', async () => {
    const resA = await api('/dashboard?date=2026-12-07', { headers: adminHeadersA });
    assert.equal(resA.status, 200);

    const dashA = resA.data;
    assert.equal(dashA.date, '2026-12-07');
    assert.equal(dashA.appointments.total, 9);
    assert.equal(dashA.appointments.cancelada, 1);
    assert.equal(dashA.appointments.programada, 8);

    // Máximo 5 elementos
    assert.equal(dashA.topServices.length, 5);
    assert.equal(dashA.frequentClients.length, 5);

    // Orden total DESC: primero 3, segundo 2, siguientes 1
    assert.equal(dashA.topServices[0].serviceId, orgA.services[0].id);
    assert.equal(dashA.topServices[0].total, 3);
    assert.equal(dashA.topServices[1].serviceId, orgA.services[1].id);
    assert.equal(dashA.topServices[1].total, 2);
    assert.equal(dashA.topServices[2].total, 1);

    assert.equal(dashA.frequentClients[0].clientId, orgA.clients[0].id);
    assert.equal(dashA.frequentClients[0].total, 3);
    assert.equal(dashA.frequentClients[1].clientId, orgA.clients[1].id);
    assert.equal(dashA.frequentClients[1].total, 2);

    // Desempate estable por ID ascendente en los empatados con total === 1
    const tiedServices = dashA.topServices.slice(2).map((s) => s.serviceId);
    assert.deepEqual(tiedServices, [...tiedServices].sort());

    // Aislamiento multi-tenant: Org A no contiene IDs de Org B
    assert.ok(!dashA.topServices.some((s) => s.serviceId === orgB.serviceId));
    assert.ok(!dashA.frequentClients.some((c) => c.clientId === orgB.clientId));

    // Org B solo ve sus propios KPIs
    const resB = await api('/dashboard?date=2026-12-07', { headers: adminHeadersB });
    assert.equal(resB.status, 200);
    assert.deepEqual(resB.data.topServices, [{ serviceId: orgB.serviceId, total: 1 }]);
    assert.deepEqual(resB.data.frequentClients, [{ clientId: orgB.clientId, total: 1 }]);

    // Fecha inválida -> 400
    const badDate = await api('/dashboard?date=2026-02-30', { headers: adminHeadersA });
    assert.equal(badDate.status, 400);
  });

  it('REC-29A: CRUD/status de RECEPTIONIST, hashing, duplicados, login activo/inactivo, RBAC y cross-tenant 404', async () => {
    // 1. ADMIN crea RECEPTIONIST -> 201 (ignorando campos prohibidos como role/organizationId)
    const createRes = await api('/receptionists', {
      method: 'POST',
      headers: adminHeadersA,
      body: {
        email: '  Recepcion.Uno@Test.Local ',
        password: 'Password123!',
        role: 'ADMIN',
        organizationId: orgB.organization.id,
      },
    });
    assert.equal(createRes.status, 201);
    const recA = createRes.data;
    assert.equal(recA.email, 'recepcion.uno@test.local');
    assert.equal(recA.role, 'RECEPTIONIST');
    assert.equal(recA.isActive, true);
    // 2 & 3. Nunca expone password ni passwordHash
    assert.equal('password' in recA, false);
    assert.equal('passwordHash' in recA, false);
    assert.equal('password_hash' in recA, false);

    // 4. Login del nuevo receptionist -> 200
    const recLoginOk = await login(
      orgA.organization.slug,
      'recepcion.uno@test.local',
      'Password123!'
    );
    assert.equal(recLoginOk.status, 200);
    assert.equal(recLoginOk.data.user.role, 'RECEPTIONIST');
    const recHeadersA = { Authorization: `Bearer ${recLoginOk.data.token}` };

    // 5. Duplicado mismo tenant -> 409
    const dupRes = await api('/receptionists', {
      method: 'POST',
      headers: adminHeadersA,
      body: { email: 'recepcion.uno@test.local', password: 'Password123!' },
    });
    assert.equal(dupRes.status, 409);

    // 6. Mismo email en tenant distinto permitido -> 201
    const otherTenantRes = await api('/receptionists', {
      method: 'POST',
      headers: adminHeadersB,
      body: { email: 'recepcion.uno@test.local', password: 'Password123!' },
    });
    assert.equal(otherTenantRes.status, 201);
    const recB = otherTenantRes.data;

    // 7, 8, 9. RECEPTIONIST, PROFESSIONAL y CLIENT reciben 403 en /receptionists
    for (const headers of [recHeadersA, proHeadersA, clientHeadersA]) {
      assert.equal((await api('/receptionists', { headers })).status, 403);
      assert.equal(
        (
          await api('/receptionists', {
            method: 'POST',
            headers,
            body: { email: 'otro@test.local', password: 'Password123!' },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await api(`/receptionists/${recA.id}/status`, {
            method: 'PATCH',
            headers,
            body: { isActive: false },
          })
        ).status,
        403
      );
    }

    // 10. ADMIN A no puede modificar receptionist B -> 404 (ni cuentas ADMIN de su propio tenant)
    const crossTenantPatch = await api(`/receptionists/${recB.id}/status`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { isActive: false },
    });
    assert.equal(crossTenantPatch.status, 404);

    const adminSelfPatch = await api(`/receptionists/${orgA.admin.id}/status`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { isActive: false },
    });
    assert.equal(adminSelfPatch.status, 404);

    // 11. Deactivate -> 200 y login rechazado (401)
    const deactivateRes = await api(`/receptionists/${recA.id}/status`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { isActive: false },
    });
    assert.equal(deactivateRes.status, 200);
    assert.equal(deactivateRes.data.isActive, false);

    const recLoginBlocked = await login(
      orgA.organization.slug,
      'recepcion.uno@test.local',
      'Password123!'
    );
    assert.equal(recLoginBlocked.status, 401);

    // 12. Reactivate -> 200 y login vuelve a funcionar
    const reactivateRes = await api(`/receptionists/${recA.id}/status`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { isActive: true },
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.data.isActive, true);

    const recLoginRestored = await login(
      orgA.organization.slug,
      'recepcion.uno@test.local',
      'Password123!'
    );
    assert.equal(recLoginRestored.status, 200);

    // 13. Listado contiene solo receptionists del tenant, sin passwordHash
    const listA = await api('/receptionists', { headers: adminHeadersA });
    assert.equal(listA.status, 200);
    assert.equal(listA.data.receptionists.length, 1);
    assert.equal(listA.data.receptionists[0].id, recA.id);
    assert.equal('passwordHash' in listA.data.receptionists[0], false);
  });
});
