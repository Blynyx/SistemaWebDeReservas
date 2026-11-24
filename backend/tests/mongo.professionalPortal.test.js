import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-professional-28-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_professional_28_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { default: app } = await import('../src/app.js');

const PAST_DAY = '2026-01-05';
const FUTURE_DAY = '2030-03-04';

describe('Portal PROFESSIONAL: agenda, HU-05, bloqueos y notificaciones (Etapa 28)', () => {
  let server;
  let baseUrl;
  let adminHeaders;
  let proA;
  let proB;
  const ids = {};

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
    const res = await api('/auth/login', {
      method: 'POST',
      body: { organizationSlug: slug, email, password },
    });
    assert.equal(res.status, 200);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${res.data.token}` };
  }

  async function adminPost(path, body, expected = 201) {
    const res = await api(path, { method: 'POST', headers: adminHeaders, body });
    assert.equal(res.status, expected, JSON.stringify(res.data));
    return res.data;
  }

  async function book(professional, startAt) {
    return adminPost('/appointments', {
      clientId: ids.client,
      professionalId: professional.id,
      serviceId: ids.service,
      startAt,
    });
  }

  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const onboard = await adminPostRaw('/onboarding/organizations', {
      organizationName: 'Org Portal Profesional',
      adminEmail: 'admin-pro28@test.local',
      adminPassword: 'Password123!',
    });
    const slug = onboard.organization.slug;
    adminHeaders = await login(slug, 'admin-pro28@test.local', 'Password123!');

    const service = await adminPost('/services', {
      name: 'Consulta',
      durationMinutes: 60,
      priceMinorUnits: 5000,
    });
    ids.service = service.id;

    async function createProfessional(name, email) {
      const pro = await adminPost('/professionals', { name, email });
      await adminPost(`/professionals/${pro.id}/services`, { serviceId: service.id });
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
        await adminPost(`/professionals/${pro.id}/schedules`, {
          dayOfWeek,
          startTime: '08:00',
          endTime: '18:00',
        });
      }
      await adminPost(`/professionals/${pro.id}/account`, { email, password: 'Password123!' });
      pro.headers = await login(slug, email, 'Password123!');
      return pro;
    }

    proA = await createProfessional('Profesional A', 'pro-a28@test.local');
    proB = await createProfessional('Profesional B', 'pro-b28@test.local');

    const client = await adminPost('/clients', { name: 'Cliente 28', email: 'cli28@test.local' });
    ids.client = client.id;

    ids.aPast1 = (await book(proA, `${PAST_DAY}T09:00`)).id;
    ids.aPast2 = (await book(proA, `${PAST_DAY}T11:00`)).id;
    ids.aFuture = (await book(proA, `${FUTURE_DAY}T09:00`)).id;
    ids.bPast = (await book(proB, `${PAST_DAY}T09:00`)).id;
  });

  async function adminPostRaw(path, body) {
    const res = await api(path, { method: 'POST', body });
    assert.equal(res.status, 201);
    return res.data;
  }

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await getMongoDb().dropDatabase().catch(() => {});
    await closeMongo();
  });

  it('HU-04: PROFESSIONAL lista únicamente sus citas, con rango from/to, e ignora professionalId externo', async () => {
    const all = await api('/me/professional/appointments', { headers: proA.headers });
    assert.equal(all.status, 200);
    const listed = all.data.appointments.map((a) => a.id);
    assert.deepEqual(new Set(listed), new Set([ids.aPast1, ids.aPast2, ids.aFuture]));
    assert.ok(all.data.appointments.every((a) => a.professionalId === proA.id));

    const ranged = await api(
      `/me/professional/appointments?from=${PAST_DAY}&to=${PAST_DAY}`,
      { headers: proA.headers }
    );
    assert.equal(ranged.status, 200);
    assert.deepEqual(
      new Set(ranged.data.appointments.map((a) => a.id)),
      new Set([ids.aPast1, ids.aPast2])
    );

    // Intento de consultar la agenda de B enviando su professionalId
    const spoof = await api(
      `/me/professional/appointments?from=${PAST_DAY}&to=${PAST_DAY}&professionalId=${proB.id}`,
      { headers: proA.headers }
    );
    assert.equal(spoof.status, 200);
    assert.ok(spoof.data.appointments.every((a) => a.professionalId === proA.id));
    assert.ok(!spoof.data.appointments.some((a) => a.id === ids.bPast));

    const bList = await api('/me/professional/appointments', { headers: proB.headers });
    assert.deepEqual(bList.data.appointments.map((a) => a.id), [ids.bPast]);
  });

  it('HU-05: complete/no-show sobre cita de otro profesional responden 404', async () => {
    const complete = await api(`/me/professional/appointments/${ids.bPast}/complete`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(complete.status, 404);

    const noShow = await api(`/me/professional/appointments/${ids.bPast}/no-show`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(noShow.status, 404);

    const stillActive = await api('/me/professional/appointments', { headers: proB.headers });
    assert.equal(stillActive.data.appointments[0].status, 'PROGRAMADA');
  });

  it('HU-05 Error: complete/no-show antes de endAt responden 409', async () => {
    const complete = await api(`/me/professional/appointments/${ids.aFuture}/complete`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(complete.status, 409);

    const noShow = await api(`/me/professional/appointments/${ids.aFuture}/no-show`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(noShow.status, 409);
  });

  it('HU-05 Happy/Alternative/Edge: complete → COMPLETADA, no-show → NO_ASISTIO y estados terminales rechazan la transición', async () => {
    const complete = await api(`/me/professional/appointments/${ids.aPast1}/complete`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(complete.status, 200);
    assert.equal(complete.data.status, 'COMPLETADA');

    // Confirmada y terminada también puede registrarse como no-show
    await api(`/appointments/${ids.aPast2}/confirm`, { method: 'PATCH', headers: adminHeaders });
    const noShow = await api(`/me/professional/appointments/${ids.aPast2}/no-show`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(noShow.status, 200);
    assert.equal(noShow.data.status, 'NO_ASISTIO');

    // Edge: terminal → backend rechaza otra transición distinta
    const invalid = await api(`/me/professional/appointments/${ids.aPast1}/no-show`, {
      method: 'PATCH',
      headers: proA.headers,
    });
    assert.equal(invalid.status, 409);

    // Las citas siguen visibles en el historial
    const list = await api('/me/professional/appointments', { headers: proA.headers });
    const byId = new Map(list.data.appointments.map((a) => [a.id, a.status]));
    assert.equal(byId.get(ids.aPast1), 'COMPLETADA');
    assert.equal(byId.get(ids.aPast2), 'NO_ASISTIO');
  });

  it('HU-09: bloques self-scoped, solapamiento 409, edición válida, aislamiento y eliminación', async () => {
    const created = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: proA.headers,
      body: { startAt: '2030-05-01T10:00', endAt: '2030-05-01T12:00', reason: 'Capacitación' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.professionalId, proA.id);
    const blockId = created.data.id;

    // Solapado → 409 (create)
    const overlap = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: proA.headers,
      body: { startAt: '2030-05-01T11:00', endAt: '2030-05-01T13:00' },
    });
    assert.equal(overlap.status, 409);

    // Adyacente es válido y luego su edición hacia un solape → 409 (patch)
    const adjacent = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: proA.headers,
      body: { startAt: '2030-05-01T12:00', endAt: '2030-05-01T13:00', reason: null },
    });
    assert.equal(adjacent.status, 201);
    const patchOverlap = await api(
      `/me/professional/availability-blocks/${adjacent.data.id}`,
      {
        method: 'PATCH',
        headers: proA.headers,
        body: { startAt: '2030-05-01T11:30' },
      }
    );
    assert.equal(patchOverlap.status, 409);

    // Edición válida (motivo e intervalo)
    const edited = await api(`/me/professional/availability-blocks/${blockId}`, {
      method: 'PATCH',
      headers: proA.headers,
      body: { startAt: '2030-05-01T09:00', endAt: '2030-05-01T11:00', reason: 'Reunión' },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.reason, 'Reunión');
    assert.equal(edited.data.startAt, '2030-05-01T09:00');

    // Aislamiento: B no ve ni modifica los bloques de A
    const bList = await api('/me/professional/availability-blocks', { headers: proB.headers });
    assert.deepEqual(bList.data.blocks, []);
    const bPatch = await api(`/me/professional/availability-blocks/${blockId}`, {
      method: 'PATCH',
      headers: proB.headers,
      body: { reason: 'Hack' },
    });
    assert.equal(bPatch.status, 404);
    await api(`/me/professional/availability-blocks/${blockId}`, {
      method: 'DELETE',
      headers: proB.headers,
    });
    const aAfterForeignDelete = await api('/me/professional/availability-blocks', {
      headers: proA.headers,
    });
    assert.ok(aAfterForeignDelete.data.blocks.some((b) => b.id === blockId));

    // Eliminación propia → 204 y desaparece
    const removed = await api(`/me/professional/availability-blocks/${blockId}`, {
      method: 'DELETE',
      headers: proA.headers,
    });
    assert.equal(removed.status, 204);
    const aList = await api('/me/professional/availability-blocks', { headers: proA.headers });
    assert.ok(!aList.data.blocks.some((b) => b.id === blockId));
    assert.ok(aList.data.blocks.every((b) => b.professionalId === proA.id));
  });

  it('HU-13: inbox del profesional autenticado, filtros read/unread e idempotencia', async () => {
    const inbox = await api('/me/notifications', { headers: proA.headers });
    assert.equal(inbox.status, 200);
    const assigned = inbox.data.notifications.filter((n) => n.type === 'APPOINTMENT_ASSIGNED');
    assert.equal(assigned.length, 3);
    assert.ok(
      inbox.data.notifications.every((n) =>
        [ids.aPast1, ids.aPast2, ids.aFuture].includes(n.appointmentId)
      )
    );
    assert.equal(inbox.data.unreadCount, inbox.data.notifications.length);

    // El inbox de B no contiene notificaciones de A
    const inboxB = await api('/me/notifications', { headers: proB.headers });
    assert.ok(inboxB.data.notifications.every((n) => n.appointmentId === ids.bPast));

    const target = assigned[0];
    const read = await api(`/me/notifications/${target.id}`, {
      method: 'PATCH',
      headers: proA.headers,
      body: { isRead: true },
    });
    assert.equal(read.status, 200);
    assert.equal(read.data.isRead, true);

    const readAgain = await api(`/me/notifications/${target.id}`, {
      method: 'PATCH',
      headers: proA.headers,
      body: { isRead: true },
    });
    assert.equal(readAgain.status, 200);
    assert.equal(readAgain.data.isRead, true);

    const unread = await api('/me/notifications?status=unread', { headers: proA.headers });
    assert.ok(unread.data.notifications.every((n) => n.isRead === false));
    assert.ok(!unread.data.notifications.some((n) => n.id === target.id));
    assert.equal(unread.data.unreadCount, inbox.data.notifications.length - 1);

    const readOnly = await api('/me/notifications?status=read', { headers: proA.headers });
    assert.deepEqual(readOnly.data.notifications.map((n) => n.id), [target.id]);

    // B no puede marcar una notificación de A
    const foreign = await api(`/me/notifications/${target.id}`, {
      method: 'PATCH',
      headers: proB.headers,
      body: { isRead: false },
    });
    assert.equal(foreign.status, 404);

    // ADMIN no tiene inbox
    const adminInbox = await api('/me/notifications', { headers: adminHeaders });
    assert.equal(adminInbox.status, 403);
  });
});
