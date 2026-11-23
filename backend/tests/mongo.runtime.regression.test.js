import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-runtime-26e-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_runtime_26e_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { default: app } = await import('../src/app.js');

describe('MongoDB Runtime API Regression (Etapa 26E)', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await getMongoDb().dropDatabase().catch(() => {});
    await closeMongo();
  });

  it('ejecuta flujo E2E completo sobre MongoDB y valida aislamiento multi-tenant', async () => {
    // 1. GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { status: 'ok' });

    // 2. Onboarding Organization + ADMIN (ORG-A)
    const onboardRes = await fetch(`${baseUrl}/api/v1/onboarding/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Clinica Mongo A',
        adminEmail: 'admin@orga.local',
        adminPassword: 'Password123!',
      }),
    });
    assert.equal(onboardRes.status, 201);
    const onboardA = await onboardRes.json();

    // 3. Login ADMIN
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: onboardA.organization.slug,
        email: 'admin@orga.local',
        password: 'Password123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const { token: adminToken } = await loginRes.json();
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // 4. GET /api/v1/auth/me
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders });
    assert.equal(meRes.status, 200);
    assert.equal((await meRes.json()).user.role, 'ADMIN');

    // 5. Create Service
    const svcRes = await fetch(`${baseUrl}/api/v1/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Consulta General',
        durationMinutes: 60,
        priceMinorUnits: 5000,
      }),
    });
    assert.equal(svcRes.status, 201);
    const service = await svcRes.json();

    // 6. Create Professional
    const proRes = await fetch(`${baseUrl}/api/v1/professionals`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Dra. Mongo', email: 'dra@orga.local' }),
    });
    assert.equal(proRes.status, 201);
    const professional = await proRes.json();

    // 7. Assign Service
    const assignRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/services`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ serviceId: service.id }),
      }
    );
    assert.equal(assignRes.status, 201);

    // 8. Create WeeklySchedule (2026-11-20 = viernes, dayOfWeek = 5)
    const schedRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/schedules`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ dayOfWeek: 5, startTime: '09:00', endTime: '12:00' }),
      }
    );
    assert.equal(schedRes.status, 201);

    // 9. Create Client
    const cliRes = await fetch(`${baseUrl}/api/v1/clients`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Cliente Mongo', email: 'cli@orga.local' }),
    });
    assert.equal(cliRes.status, 201);
    const client = await cliRes.json();

    // 15. Provision Professional account (antes de crear cita para verificar notificaciones)
    const proAccRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/account`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: 'dra@orga.local', password: 'Password123!' }),
      }
    );
    assert.equal(proAccRes.status, 201);

    // 10. Availability
    const availRes = await fetch(
      `${baseUrl}/api/v1/availability?serviceId=${service.id}&date=2026-11-20`,
      { headers: authHeaders }
    );
    assert.equal(availRes.status, 200);
    const avail = await availRes.json();
    assert.ok(avail.professionals[0].slots.some((s) => s.startAt === '2026-11-20T09:00'));

    // 11 & 12. Create Appointment -> PROGRAMADA
    const aptRes = await fetch(`${baseUrl}/api/v1/appointments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        startAt: '2026-11-20T09:00',
      }),
    });
    assert.equal(aptRes.status, 201);
    const apt = await aptRes.json();
    assert.equal(apt.status, 'PROGRAMADA');

    // 13 & 14. Confirm Appointment -> CONFIRMADA
    const confirmRes = await fetch(`${baseUrl}/api/v1/appointments/${apt.id}/confirm`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal((await confirmRes.json()).status, 'CONFIRMADA');

    // 16. Professional login
    const proLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: onboardA.organization.slug,
        email: 'dra@orga.local',
        password: 'Password123!',
      }),
    });
    assert.equal(proLoginRes.status, 200);
    const { token: proToken } = await proLoginRes.json();

    // 17. Professional notifications (debe tener ASSIGNMENT + ... de la misma tx)
    const notifRes = await fetch(`${baseUrl}/api/v1/me/notifications`, {
      headers: { Authorization: `Bearer ${proToken}` },
    });
    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.ok(notifData.notifications.length >= 1);

    // 18 & 19. Cancel Appointment -> CANCELADA
    const cancelRes = await fetch(`${baseUrl}/api/v1/appointments/${apt.id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert.equal(cancelRes.status, 200);
    assert.equal((await cancelRes.json()).status, 'CANCELADA');

    // 20. Dashboard
    const dashRes = await fetch(`${baseUrl}/api/v1/dashboard?date=2026-11-20`, {
      headers: authHeaders,
    });
    assert.equal(dashRes.status, 200);
    const dash = await dashRes.json();
    assert.equal(dash.appointments.cancelada, 1);

    // 21. Tenant isolation básico (ORG-B no ve recursos de ORG-A)
    const onboardBRes = await fetch(`${baseUrl}/api/v1/onboarding/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Clinica Mongo B',
        adminEmail: 'admin@orgb.local',
        adminPassword: 'Password123!',
      }),
    });
    assert.equal(onboardBRes.status, 201);
    const onboardB = await onboardBRes.json();

    const loginBRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: onboardB.organization.slug,
        email: 'admin@orgb.local',
        password: 'Password123!',
      }),
    });
    const { token: tokenB } = await loginBRes.json();
    const headersB = { Authorization: `Bearer ${tokenB}` };

    assert.equal((await fetch(`${baseUrl}/api/v1/appointments/${apt.id}`, { headers: headersB })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/v1/clients/${client.id}`, { headers: headersB })).status, 404);
    assert.deepEqual(
      (await (await fetch(`${baseUrl}/api/v1/appointments`, { headers: headersB })).json()).appointments,
      []
    );
  });
});
