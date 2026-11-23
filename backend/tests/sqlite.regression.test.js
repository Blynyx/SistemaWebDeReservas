import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const tempDbPath = path.join(os.tmpdir(), `reservas-regression-${Date.now()}.db`);
process.env.DB_PATH = tempDbPath;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'sqlite-regression-secret';

// Importar migrate y app después de fijar DB_PATH
await import('../src/database/migrate.js');
const { getDb } = await import('../src/database/connection.js');
const { default: app } = await import('../src/app.js');

describe('SQLite Runtime Regression (Etapa 26B)', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server?.close();
    getDb().close();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('mantiene operativos health, onboarding, login, /auth/me, availability, citas, lifecycle, notifications y dashboard', async () => {
    // 1. Health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { status: 'ok' });

    // 2. Onboarding
    const onboardRes = await fetch(`${baseUrl}/api/v1/onboarding/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Clinica Regression',
        adminEmail: 'admin@regression.local',
        adminPassword: 'Password123!',
      }),
    });
    assert.equal(onboardRes.status, 201);
    const onboardData = await onboardRes.json();
    const orgSlug = onboardData.organization.slug;

    // 3. Login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: orgSlug,
        email: 'admin@regression.local',
        password: 'Password123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const { token } = await loginRes.json();
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 4. /auth/me
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders });
    assert.equal(meRes.status, 200);
    const me = await meRes.json();
    assert.equal(me.user.role, 'ADMIN');

    // 5. Crear servicio, profesional, asignación, horario y cliente
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

    const proRes = await fetch(`${baseUrl}/api/v1/professionals`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Dra. Regression', email: 'dra@regression.local' }),
    });
    assert.equal(proRes.status, 201);
    const professional = await proRes.json();

    const assignRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/services`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ serviceId: service.id }),
      }
    );
    assert.equal(assignRes.status, 201);

    // 2026-11-20 es viernes (dayOfWeek = 5)
    const schedRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/schedules`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ dayOfWeek: 5, startTime: '09:00', endTime: '12:00' }),
      }
    );
    assert.equal(schedRes.status, 201);

    const cliRes = await fetch(`${baseUrl}/api/v1/clients`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Cliente Test', email: 'cli@regression.local' }),
    });
    assert.equal(cliRes.status, 201);
    const client = await cliRes.json();

    // 6. Availability
    const availRes = await fetch(
      `${baseUrl}/api/v1/availability?serviceId=${service.id}&date=2026-11-20`,
      { headers: authHeaders }
    );
    assert.equal(availRes.status, 200);
    const avail = await availRes.json();
    assert.equal(avail.professionals.length, 1);
    assert.ok(avail.professionals[0].slots.some((s) => s.startAt === '2026-11-20T09:00'));

    // 7. Creación de cita
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

    // 8. Lifecycle (confirm -> cancel)
    const confirmRes = await fetch(`${baseUrl}/api/v1/appointments/${apt.id}/confirm`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal((await confirmRes.json()).status, 'CONFIRMADA');

    const cancelRes = await fetch(`${baseUrl}/api/v1/appointments/${apt.id}/cancel`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert.equal(cancelRes.status, 200);
    assert.equal((await cancelRes.json()).status, 'CANCELADA');

    // 9. Notifications (como PROFESSIONAL)
    const proAccRes = await fetch(
      `${baseUrl}/api/v1/professionals/${professional.id}/account`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          email: 'dra@regression.local',
          password: 'Password123!',
        }),
      }
    );
    assert.equal(proAccRes.status, 201);

    const proLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationSlug: orgSlug,
        email: 'dra@regression.local',
        password: 'Password123!',
      }),
    });
    assert.equal(proLoginRes.status, 200);
    const { token: proToken } = await proLoginRes.json();

    const notifRes = await fetch(`${baseUrl}/api/v1/me/notifications`, {
      headers: { Authorization: `Bearer ${proToken}` },
    });
    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.ok(Array.isArray(notifData.notifications));

    // 10. Dashboard
    const dashRes = await fetch(`${baseUrl}/api/v1/dashboard?date=2026-11-20`, {
      headers: authHeaders,
    });
    assert.equal(dashRes.status, 200);
    const dash = await dashRes.json();
    assert.ok(dash);
  });
});
