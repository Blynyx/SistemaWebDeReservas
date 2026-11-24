import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-stage29b-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_stage_29b_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { default: app } = await import('../src/app.js');

describe('Etapa 29B — Modificación general segura de citas (PATCH /appointments/:id)', () => {
  let server;
  let baseUrl;
  let adminHeadersA;
  let recHeadersA;
  let proHeadersA;
  let proHeadersB;
  let clientHeadersA;
  let clientHeaders2;
  let adminHeadersOther;

  const resA = {};
  const resOther = {};

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
    const r = await api('/auth/login', {
      method: 'POST',
      body: { organizationSlug: slug, email, password },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { Authorization: `Bearer ${r.data.token}` };
  }

  async function mustPost(path, headers, body, expected = 201) {
    const r = await api(path, { method: 'POST', headers, body });
    assert.equal(r.status, expected, JSON.stringify(r.data));
    return r.data;
  }

  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Org A
    const orgA = await mustPost('/onboarding/organizations', {}, {
      organizationName: 'Org 29B A',
      adminEmail: 'admin-29b-a@test.local',
      adminPassword: 'Password123!',
    });
    adminHeadersA = await login(orgA.organization.slug, 'admin-29b-a@test.local', 'Password123!');

    // Receptionist A
    await mustPost('/receptionists', adminHeadersA, {
      email: 'rec-29b@test.local',
      password: 'Password123!',
    });
    recHeadersA = await login(orgA.organization.slug, 'rec-29b@test.local', 'Password123!');

    // Services A
    resA.svc30 = await mustPost('/services', adminHeadersA, {
      name: 'Servicio 30m',
      durationMinutes: 30,
      priceMinorUnits: 2000,
    });
    resA.svc60 = await mustPost('/services', adminHeadersA, {
      name: 'Servicio 60m',
      durationMinutes: 60,
      priceMinorUnits: 4500,
    });
    resA.svc120 = await mustPost('/services', adminHeadersA, {
      name: 'Servicio 120m',
      durationMinutes: 120,
      priceMinorUnits: 9000,
    });
    resA.svcUnassigned = await mustPost('/services', adminHeadersA, {
      name: 'Servicio No Asignado',
      durationMinutes: 30,
      priceMinorUnits: 1500,
    });

    // Clients A (con cuentas para probar notificaciones UPDATED y REASSIGNED)
    resA.cli1 = await mustPost('/clients', adminHeadersA, {
      name: 'Cliente Uno',
      email: 'cli1-29b@test.local',
    });
    await mustPost(`/clients/${resA.cli1.id}/account`, adminHeadersA, {
      email: 'cli1-29b@test.local',
      password: 'Password123!',
    });
    clientHeadersA = await login(orgA.organization.slug, 'cli1-29b@test.local', 'Password123!');

    resA.cli2 = await mustPost('/clients', adminHeadersA, {
      name: 'Cliente Dos',
      email: 'cli2-29b@test.local',
    });
    await mustPost(`/clients/${resA.cli2.id}/account`, adminHeadersA, {
      email: 'cli2-29b@test.local',
      password: 'Password123!',
    });
    clientHeaders2 = await login(orgA.organization.slug, 'cli2-29b@test.local', 'Password123!');

    // Professionals A, B, C
    async function setupPro(name, email, assignServices, endTime = '13:00') {
      const p = await mustPost('/professionals', adminHeadersA, { name, email });
      await mustPost(`/professionals/${p.id}/account`, adminHeadersA, {
        email,
        password: 'Password123!',
      });
      for (const svc of assignServices) {
        await mustPost(`/professionals/${p.id}/services`, adminHeadersA, { serviceId: svc.id });
      }
      // Lunes (dayOfWeek = 1)
      await mustPost(`/professionals/${p.id}/schedules`, adminHeadersA, {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime,
      });
      return p;
    }

    resA.proA = await setupPro('Prof A', 'pro-a-29b@test.local', [resA.svc30, resA.svc60, resA.svc120], '12:00');
    resA.proB = await setupPro('Prof B', 'pro-b-29b@test.local', [resA.svc30, resA.svc60], '12:00');
    resA.proC = await setupPro('Prof C', 'pro-c-29b@test.local', [resA.svc30, resA.svc60], '12:00');
    proHeadersA = await login(orgA.organization.slug, 'pro-a-29b@test.local', 'Password123!');
    proHeadersB = await login(orgA.organization.slug, 'pro-b-29b@test.local', 'Password123!');

    // Org Other (para cross-tenant)
    const orgOther = await mustPost('/onboarding/organizations', {}, {
      organizationName: 'Org 29B Other',
      adminEmail: 'admin-29b-other@test.local',
      adminPassword: 'Password123!',
    });
    adminHeadersOther = await login(
      orgOther.organization.slug,
      'admin-29b-other@test.local',
      'Password123!'
    );
    resOther.cli = await mustPost('/clients', adminHeadersOther, {
      name: 'Cliente Otro Tenant',
      email: 'cli-other@test.local',
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await getMongoDb().dropDatabase().catch(() => {});
    await closeMongo();
  });

  it('1-4, 15-16: PATCH clientId/professionalId/serviceId, snapshots, status preservado, notificaciones UPDATED/REASSIGNED y no-op', async () => {
    // Crear cita en lunes 2026-12-07T09:00 (30 min, 2000) y confirmarla
    const created = await mustPost('/appointments', adminHeadersA, {
      clientId: resA.cli1.id,
      professionalId: resA.proA.id,
      serviceId: resA.svc30.id,
      startAt: '2026-12-07T09:00',
    });
    const confirmRes = await api(`/appointments/${created.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeadersA,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.status, 'CONFIRMADA');

    // Modificar el precio/duración del servicio maestro svc30 para verificar que sin cambio de serviceId se preservan snapshots
    const patchMasterSvc = await api(`/services/${resA.svc30.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { durationMinutes: 45, priceMinorUnits: 9999 },
    });
    assert.equal(patchMasterSvc.status, 200);

    // 1 & 4. PATCH clientId (sin cambiar serviceId) por RECEPTIONIST -> 200, preserva status CONFIRMADA, startAt, endAt y snapshots originales
    const editClient = await api(`/appointments/${created.id}`, {
      method: 'PATCH',
      headers: recHeadersA,
      body: { clientId: resA.cli2.id },
    });
    assert.equal(editClient.status, 200);
    assert.equal(editClient.data.id, created.id);
    assert.equal(editClient.data.clientId, resA.cli2.id);
    assert.equal(editClient.data.startAt, '2026-12-07T09:00');
    assert.equal(editClient.data.endAt, '2026-12-07T09:30');
    assert.equal(editClient.data.serviceDurationMinutes, 30);
    assert.equal(editClient.data.servicePriceMinorUnits, 2000);
    assert.equal(editClient.data.status, 'CONFIRMADA');
    assert.equal(editClient.data.createdAt, created.createdAt);

    // 15. Verificar notificaciones: cli1 recibe APPOINTMENT_REASSIGNED, cli2 recibe APPOINTMENT_UPDATED, proA recibe APPOINTMENT_UPDATED
    const cli1Notifs = (await api('/me/notifications', { headers: clientHeadersA })).data.notifications;
    assert.ok(cli1Notifs.some((n) => n.appointmentId === created.id && n.type === 'APPOINTMENT_REASSIGNED'));

    const cli2Notifs = (await api('/me/notifications', { headers: clientHeaders2 })).data.notifications;
    assert.ok(cli2Notifs.some((n) => n.appointmentId === created.id && n.type === 'APPOINTMENT_UPDATED'));

    // 16. No-op (mismos valores) -> 200 sin generar notificaciones adicionales ni alterar updatedAt
    const notifCountBeforeNoop = cli2Notifs.length;
    const updatedAtBeforeNoop = editClient.data.updatedAt;
    const noopRes = await api(`/appointments/${created.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: {
        clientId: resA.cli2.id,
        professionalId: resA.proA.id,
        serviceId: resA.svc30.id,
      },
    });
    assert.equal(noopRes.status, 200);
    assert.equal(noopRes.data.updatedAt, updatedAtBeforeNoop);
    const cli2NotifsAfterNoop = (await api('/me/notifications', { headers: clientHeaders2 })).data.notifications;
    assert.equal(cli2NotifsAfterNoop.length, notifCountBeforeNoop);

    // 2. PATCH professionalId (proA -> proB) -> 200, proA recibe REASSIGNED y proB recibe UPDATED
    const editPro = await api(`/appointments/${created.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { professionalId: resA.proB.id },
    });
    assert.equal(editPro.status, 200);
    assert.equal(editPro.data.professionalId, resA.proB.id);
    assert.equal(editPro.data.status, 'CONFIRMADA');
    assert.equal(editPro.data.startAt, '2026-12-07T09:00');

    const proANotifs = (await api('/me/notifications', { headers: proHeadersA })).data.notifications;
    assert.ok(proANotifs.some((n) => n.appointmentId === created.id && n.type === 'APPOINTMENT_REASSIGNED'));
    const proBNotifs = (await api('/me/notifications', { headers: proHeadersB })).data.notifications;
    assert.ok(proBNotifs.some((n) => n.appointmentId === created.id && n.type === 'APPOINTMENT_UPDATED'));

    // 3. PATCH serviceId (svc30 -> svc60) -> 200, actualiza snapshots (60 min, 4500) y recalcula endAt (10:00)
    const editSvc = await api(`/appointments/${created.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { serviceId: resA.svc60.id },
    });
    assert.equal(editSvc.status, 200);
    assert.equal(editSvc.data.serviceId, resA.svc60.id);
    assert.equal(editSvc.data.serviceDurationMinutes, 60);
    assert.equal(editSvc.data.servicePriceMinorUnits, 4500);
    assert.equal(editSvc.data.startAt, '2026-12-07T09:00');
    assert.equal(editSvc.data.endAt, '2026-12-07T10:00');
    assert.equal(editSvc.data.status, 'CONFIRMADA');

    // Restaurar svc30 a 30 min para el resto de pruebas
    await api(`/services/${resA.svc30.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { durationMinutes: 30, priceMinorUnits: 2000 },
    });
  });

  it('5-13: campos prohibidos (startAt -> 400), terminales -> 409, incompatibilidad/colisión/duración -> 409, cross-tenant -> 404, RBAC -> 403', async () => {
    const apt = await mustPost('/appointments', adminHeadersA, {
      clientId: resA.cli1.id,
      professionalId: resA.proA.id,
      serviceId: resA.svc60.id,
      startAt: '2026-12-14T11:00',
    });

    // 5. startAt enviado al PATCH general -> 400 con mensaje orientativo
    const startAtErr = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { startAt: '2026-12-14T10:00' },
    });
    assert.equal(startAtErr.status, 400);
    assert.match(startAtErr.data.message, /reprogramación/i);

    // Otros campos prohibidos -> 400
    for (const forbidden of [{ status: 'CANCELADA' }, { endAt: '2026-12-14T11:30' }, { organizationId: 'x' }]) {
      const r = await api(`/appointments/${apt.id}`, {
        method: 'PATCH',
        headers: adminHeadersA,
        body: forbidden,
      });
      assert.equal(r.status, 400);
    }

    // 7. Professional/service incompatible -> 409
    const incompat = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { serviceId: resA.svcUnassigned.id },
    });
    assert.equal(incompat.status, 409);

    // 9. Servicio más largo (120m desde 11:00 -> 13:00, pero horario termina 12:00) -> 409 y cita intacta
    const tooLong = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { serviceId: resA.svc120.id },
    });
    assert.equal(tooLong.status, 409);
    const intact1 = (await api(`/appointments/${apt.id}`, { headers: adminHeadersA })).data;
    assert.equal(intact1.serviceId, resA.svc60.id);
    assert.equal(intact1.endAt, '2026-12-14T12:00');

    // 8. Cambio de profesional a slot ocupado -> 409 y cita intacta
    await mustPost('/appointments', adminHeadersA, {
      clientId: resA.cli2.id,
      professionalId: resA.proB.id,
      serviceId: resA.svc60.id,
      startAt: '2026-12-14T11:00',
    });
    const busyPro = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { professionalId: resA.proB.id },
    });
    assert.equal(busyPro.status, 409);
    const intact2 = (await api(`/appointments/${apt.id}`, { headers: adminHeadersA })).data;
    assert.equal(intact2.professionalId, resA.proA.id);

    // 10. Cross-tenant Appointment -> 404
    const crossApt = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersOther,
      body: { clientId: resOther.cli.id },
    });
    assert.equal(crossApt.status, 404);

    // 11. Recurso destino cross-tenant -> 404
    const crossClient = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { clientId: resOther.cli.id },
    });
    assert.equal(crossClient.status, 404);

    // 12 & 13. PROFESSIONAL y CLIENT -> 403
    assert.equal(
      (
        await api(`/appointments/${apt.id}`, {
          method: 'PATCH',
          headers: proHeadersA,
          body: { clientId: resA.cli2.id },
        })
      ).status,
      403
    );
    assert.equal(
      (
        await api(`/appointments/${apt.id}`, {
          method: 'PATCH',
          headers: clientHeadersA,
          body: { clientId: resA.cli2.id },
        })
      ).status,
      403
    );

    // 6. Cita terminal (CANCELADA) -> 409
    await api(`/appointments/${apt.id}/cancel`, { method: 'PATCH', headers: adminHeadersA });
    const editTerminal = await api(`/appointments/${apt.id}`, {
      method: 'PATCH',
      headers: adminHeadersA,
      body: { clientId: resA.cli2.id },
    });
    assert.equal(editTerminal.status, 409);
  });

  it('14. CONC-29B-01: dos PATCH concurrentes moviendo citas al mismo profesional/horario -> 1x200 + 1x409', async () => {
    const aptA = await mustPost('/appointments', adminHeadersA, {
      clientId: resA.cli1.id,
      professionalId: resA.proA.id,
      serviceId: resA.svc60.id,
      startAt: '2026-12-21T10:00',
    });
    const aptB = await mustPost('/appointments', adminHeadersA, {
      clientId: resA.cli2.id,
      professionalId: resA.proB.id,
      serviceId: resA.svc60.id,
      startAt: '2026-12-21T10:00',
    });

    const [res1, res2] = await Promise.all([
      api(`/appointments/${aptA.id}`, {
        method: 'PATCH',
        headers: adminHeadersA,
        body: { professionalId: resA.proC.id },
      }),
      api(`/appointments/${aptB.id}`, {
        method: 'PATCH',
        headers: adminHeadersA,
        body: { professionalId: resA.proC.id },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 409]);

    // Verificar estado persistido: solo una ocupa proC y la otra conserva su profesional origen
    const afterA = (await api(`/appointments/${aptA.id}`, { headers: adminHeadersA })).data;
    const afterB = (await api(`/appointments/${aptB.id}`, { headers: adminHeadersA })).data;

    const onProC = [afterA, afterB].filter((a) => a.professionalId === resA.proC.id);
    assert.equal(onProC.length, 1);

    if (afterA.professionalId === resA.proC.id) {
      assert.equal(afterB.professionalId, resA.proB.id);
    } else {
      assert.equal(afterA.professionalId, resA.proA.id);
      assert.equal(afterB.professionalId, resA.proC.id);
    }
  });
});
