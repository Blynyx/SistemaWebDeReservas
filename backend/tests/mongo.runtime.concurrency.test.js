import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-conc-26e-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_runtime_conc_26e_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { default: app } = await import('../src/app.js');

async function setupOrgAndResources(baseUrl, suffix) {
  const onboardRes = await fetch(`${baseUrl}/api/v1/onboarding/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Org Conc ${suffix}`,
      adminEmail: `admin-${suffix}@conc.local`,
      adminPassword: 'Password123!',
    }),
  });
  assert.equal(onboardRes.status, 201);
  const { organization } = await onboardRes.json();

  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationSlug: organization.slug,
      email: `admin-${suffix}@conc.local`,
      password: 'Password123!',
    }),
  });
  const { token } = await loginRes.json();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const service = await (
    await fetch(`${baseUrl}/api/v1/services`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Consulta 60', durationMinutes: 60, priceMinorUnits: 5000 }),
    })
  ).json();

  const professional = await (
    await fetch(`${baseUrl}/api/v1/professionals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Dr. Conc', email: `pro-${suffix}@conc.local` }),
    })
  ).json();

  await fetch(`${baseUrl}/api/v1/professionals/${professional.id}/services`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ serviceId: service.id }),
  });

  // 2026-11-20 = viernes (dayOfWeek = 5) y 2026-11-21 = sábado (dayOfWeek = 6)
  await fetch(`${baseUrl}/api/v1/professionals/${professional.id}/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dayOfWeek: 5, startTime: '09:00', endTime: '13:00' }),
  });
  await fetch(`${baseUrl}/api/v1/professionals/${professional.id}/schedules`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dayOfWeek: 6, startTime: '09:00', endTime: '13:00' }),
  });

  const client = await (
    await fetch(`${baseUrl}/api/v1/clients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Cliente Conc', email: `cli-${suffix}@conc.local` }),
    })
  ).json();

  return { headers, organization, service, professional, client };
}

describe('MongoDB Runtime API Concurrency & Reschedule (Etapa 26E)', () => {
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

  it('CONC-MONGO-01 API: dos POST /appointments simultáneos mismo slot -> 1x201, 1x409 y 1 cita activa', async () => {
    const { headers, service, professional, client } = await setupOrgAndResources(baseUrl, 'c1');

    const post = () =>
      fetch(`${baseUrl}/api/v1/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId: client.id,
          professionalId: professional.id,
          serviceId: service.id,
          startAt: '2026-11-20T09:00',
        }),
      });

    const [resA, resB] = await Promise.all([post(), post()]);
    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 409]);

    const activeCount = await getMongoDb()
      .collection('appointments')
      .countDocuments({
        professionalId: professional.id,
        startAt: '2026-11-20T09:00',
        status: { $in: ['PROGRAMADA', 'CONFIRMADA'] },
      });
    assert.equal(activeCount, 1);
  });

  it('CONC-MONGO-02 API: citas adyacentes 09:00 y 10:00 (60 min) -> ambas HTTP 201', async () => {
    const { headers, service, professional, client } = await setupOrgAndResources(baseUrl, 'c2');

    const res1 = await fetch(`${baseUrl}/api/v1/appointments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        startAt: '2026-11-20T09:00',
      }),
    });
    const res2 = await fetch(`${baseUrl}/api/v1/appointments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        startAt: '2026-11-20T10:00',
      }),
    });

    assert.equal(res1.status, 201);
    assert.equal(res2.status, 201);
    const apt1 = await res1.json();
    const apt2 = await res2.json();
    assert.equal(apt1.startAt, '2026-11-20T09:00');
    assert.equal(apt1.endAt, '2026-11-20T10:00');
    assert.equal(apt2.startAt, '2026-11-20T10:00');
    assert.equal(apt2.endAt, '2026-11-20T11:00');
  });

  it('Reschedule: 409 hacia slot ocupado conserva horario anterior; reschedule válido retorna 200 PROGRAMADA con snapshots', async () => {
    const { headers, service, professional, client } = await setupOrgAndResources(baseUrl, 'rs');

    const aptA = await (
      await fetch(`${baseUrl}/api/v1/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId: client.id,
          professionalId: professional.id,
          serviceId: service.id,
          startAt: '2026-11-20T09:00',
        }),
      })
    ).json();

    await fetch(`${baseUrl}/api/v1/appointments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: client.id,
        professionalId: professional.id,
        serviceId: service.id,
        startAt: '2026-11-20T10:00',
      }),
    });

    // Intento hacia slot ocupado -> 409 y conserva 09:00
    const conflictRes = await fetch(`${baseUrl}/api/v1/appointments/${aptA.id}/reschedule`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ startAt: '2026-11-20T10:00' }),
    });
    assert.equal(conflictRes.status, 409);

    const unchanged = await (
      await fetch(`${baseUrl}/api/v1/appointments/${aptA.id}`, { headers })
    ).json();
    assert.equal(unchanged.startAt, '2026-11-20T09:00');

    // Reprogramación válida a fecha destino 2026-11-21 -> 200, mismo id, PROGRAMADA, snapshots intactos
    const okRes = await fetch(`${baseUrl}/api/v1/appointments/${aptA.id}/reschedule`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ startAt: '2026-11-21T11:00' }),
    });
    assert.equal(okRes.status, 200);
    const rescheduled = await okRes.json();
    assert.equal(rescheduled.id, aptA.id);
    assert.equal(rescheduled.status, 'PROGRAMADA');
    assert.equal(rescheduled.startAt, '2026-11-21T11:00');
    assert.equal(rescheduled.endAt, '2026-11-21T12:00');
    assert.equal(rescheduled.serviceDurationMinutes, 60);
    assert.equal(rescheduled.servicePriceMinorUnits, 5000);
  });
});
