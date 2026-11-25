import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mongo-sdd-acceptance-30b-secret';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = 'reservas_sdd_acceptance_30b_test';

const { closeMongo, connectMongo, getMongoDb } = await import(
  '../src/database/mongodb/client.js'
);
const { ensureIndexes } = await import('../src/database/mongodb/indexes.js');
const { assertAppointmentHasEndedAt } = await import(
  '../src/modules/appointments/appointment.service.js'
);
const { default: app } = await import('../src/app.js');

describe('SDD Acceptance Suite — Rectificación 52/52 (Etapa 30B-R)', () => {
  let server;
  let baseUrl;
  let organizationId;
  let orgSlug;
  let adminHeaders;
  let mainService;

  async function api(path, { method = 'GET', headers, body } = {}) {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }

  async function loginSession(email, password) {
    const res = await api('/auth/login', {
      method: 'POST',
      body: { organizationSlug: orgSlug, email, password },
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return {
      headers: { Authorization: `Bearer ${res.data.token}` },
      user: res.data.user,
    };
  }

  async function createPro({
    name,
    email,
    serviceIds = [mainService.id],
    schedules = [],
    withAccount = true,
  }) {
    const createRes = await api('/professionals', {
      method: 'POST',
      headers: adminHeaders,
      body: { name, email },
    });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.data));
    const pro = createRes.data;

    for (const serviceId of serviceIds) {
      const assignRes = await api(`/professionals/${pro.id}/services`, {
        method: 'POST',
        headers: adminHeaders,
        body: { serviceId },
      });
      assert.equal(assignRes.status, 201, JSON.stringify(assignRes.data));
    }

    for (const schedule of schedules) {
      const schedRes = await api(`/professionals/${pro.id}/schedules`, {
        method: 'POST',
        headers: adminHeaders,
        body: schedule,
      });
      assert.equal(schedRes.status, 201, JSON.stringify(schedRes.data));
    }

    if (withAccount) {
      const accRes = await api(`/professionals/${pro.id}/account`, {
        method: 'POST',
        headers: adminHeaders,
        body: { email, password: 'Password123!' },
      });
      assert.equal(accRes.status, 201, JSON.stringify(accRes.data));
      const session = await loginSession(email, 'Password123!');
      pro.headers = session.headers;
      pro.userAccountId = session.user.id;
    }

    return pro;
  }

  async function createClient({ name, email, withAccount = true }) {
    const createRes = await api('/clients', {
      method: 'POST',
      headers: adminHeaders,
      body: { name, email },
    });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.data));
    const client = createRes.data;

    if (withAccount) {
      const accRes = await api(`/clients/${client.id}/account`, {
        method: 'POST',
        headers: adminHeaders,
        body: { email, password: 'Password123!' },
      });
      assert.equal(accRes.status, 201, JSON.stringify(accRes.data));
      const session = await loginSession(email, 'Password123!');
      client.headers = session.headers;
      client.userAccountId = session.user.id;
    }

    return client;
  }

  async function createReceptionist({ email }) {
    const createRes = await api('/receptionists', {
      method: 'POST',
      headers: adminHeaders,
      body: { email, password: 'Password123!' },
    });
    assert.equal(createRes.status, 201, JSON.stringify(createRes.data));
    const session = await loginSession(email, 'Password123!');
    return {
      id: createRes.data.id ?? session.user.id,
      email,
      headers: session.headers,
      userAccountId: session.user.id,
    };
  }

  function extractSlotsForProfessional(availabilityPayload, professionalId) {
    const entry = (availabilityPayload?.professionals ?? []).find((p) => p.id === professionalId);
    return entry ? entry.slots.map((s) => s.startAt) : [];
  }

  function extractSlotObjectsForProfessional(availabilityPayload, professionalId) {
    const entry = (availabilityPayload?.professionals ?? []).find((p) => p.id === professionalId);
    return entry ? entry.slots : [];
  }

  before(async () => {
    await connectMongo({ uri: TEST_URI, dbName: TEST_DB_NAME });
    await getMongoDb().dropDatabase();
    await ensureIndexes(getMongoDb());

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const onboard = await api('/onboarding/organizations', {
      method: 'POST',
      body: {
        organizationName: 'Org SDD 30B',
        adminEmail: 'admin30b@test.local',
        adminPassword: 'Password123!',
      },
    });
    assert.equal(onboard.status, 201, JSON.stringify(onboard.data));
    organizationId = onboard.data.organization.id;
    orgSlug = onboard.data.organization.slug;
    adminHeaders = (await loginSession('admin30b@test.local', 'Password123!')).headers;

    const svcRes = await api('/services', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        name: 'Consulta 60m',
        durationMinutes: 60,
        priceMinorUnits: 5000,
      },
    });
    assert.equal(svcRes.status, 201, JSON.stringify(svcRes.data));
    mainService = svcRes.data;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await getMongoDb().dropDatabase();
    await closeMongo();
  });

  // ---------------------------------------------------------------------------
  // HU-01 — Consultar disponibilidad
  // ---------------------------------------------------------------------------

  it('TC-HU01-01: disponibilidad de profesional específico considera horario semanal, bloqueo, cita PROGRAMADA, cita CONFIRMADA e intervalo libre', async () => {
    // 2030-05-06 is Monday (dayOfWeek = 1)
    const date = '2030-05-06';
    const proTarget = await createPro({
      name: 'Pro HU01-01 Target',
      email: 'pro.hu0101.target@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '14:00' }],
    });
    // Otro profesional habilitado en la misma fecha para verificar filtro por professionalId
    await createPro({
      name: 'Pro HU01-01 Otro',
      email: 'pro.hu0101.other@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '14:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU01-01',
      email: 'cli.hu0101@test.local',
    });

    // Cita PROGRAMADA: 09:00-10:00
    const aptProg = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: proTarget.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(aptProg.status, 201);
    assert.equal(aptProg.data.status, 'PROGRAMADA');

    // Cita CONFIRMADA: 10:00-11:00
    const aptConf = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: proTarget.id, serviceId: mainService.id, startAt: `${date}T10:00` },
    });
    assert.equal(aptConf.status, 201);
    const confirmRes = await api(`/appointments/${aptConf.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.status, 'CONFIRMADA');

    // Bloqueo excepcional: 11:00-12:00
    const blockRes = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: proTarget.headers,
      body: { startAt: `${date}T11:00`, endAt: `${date}T12:00`, reason: 'Bloqueo clínico' },
    });
    assert.equal(blockRes.status, 201);

    // Intervalo libre esperado: 12:00-14:00 -> slots 12:00, 12:30, 13:00 (servicio 60m)
    const availRes = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${proTarget.id}`,
      { headers: client.headers }
    );
    assert.equal(availRes.status, 200);
    assert.equal(availRes.data.professionals.length, 1);
    assert.equal(availRes.data.professionals[0].id, proTarget.id);

    const slots = extractSlotsForProfessional(availRes.data, proTarget.id);
    assert.deepEqual(slots, [`${date}T12:00`, `${date}T12:30`, `${date}T13:00`]);
    assert.ok(!slots.includes(`${date}T08:30`), 'No incluye fuera de jornada');
    assert.ok(!slots.includes(`${date}T09:00`), 'No incluye cita PROGRAMADA');
    assert.ok(!slots.includes(`${date}T09:30`), 'No incluye solapamiento parcial con PROGRAMADA');
    assert.ok(!slots.includes(`${date}T10:00`), 'No incluye cita CONFIRMADA');
    assert.ok(!slots.includes(`${date}T11:00`), 'No incluye bloqueo');
    assert.ok(!slots.includes(`${date}T11:30`), 'No incluye solapamiento parcial con bloqueo');
    assert.ok(!slots.includes(`${date}T13:30`), 'No incluye slot que excede 14:00');
  });

  it('TC-HU01-02: consulta con cualquier profesional habilitado devuelve los profesionales e identifica el profesional de cada slot', async () => {
    // 2030-06-03 is Monday (1)
    const date = '2030-06-03';
    const svc = (
      await api('/services', {
        method: 'POST',
        headers: adminHeaders,
        body: { name: 'Servicio MultiPro HU01-02', durationMinutes: 60, priceMinorUnits: 4000 },
      })
    ).data;
    const pro1 = await createPro({
      name: 'Pro Multi 1',
      email: 'pro.multi1@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00' }],
      withAccount: false,
    });
    const pro2 = await createPro({
      name: 'Pro Multi 2',
      email: 'pro.multi2@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 1, startTime: '14:00', endTime: '16:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU01-02',
      email: 'cli.hu0102@test.local',
    });

    const avail = await api(`/availability?serviceId=${svc.id}&date=${date}`, {
      headers: client.headers,
    });
    assert.equal(avail.status, 200);
    const ids = avail.data.professionals.map((p) => p.id);
    assert.ok(ids.includes(pro1.id));
    assert.ok(ids.includes(pro2.id));
    assert.equal(
      avail.data.professionals.find((p) => p.id === pro1.id).name,
      'Pro Multi 1'
    );
    assert.equal(
      avail.data.professionals.find((p) => p.id === pro2.id).name,
      'Pro Multi 2'
    );
    assert.ok(extractSlotsForProfessional(avail.data, pro1.id).includes(`${date}T09:00`));
    assert.ok(extractSlotsForProfessional(avail.data, pro2.id).includes(`${date}T14:00`));
  });

  it('TC-HU01-03: GET /availability sin serviceId retorna 400 con mensaje de validación', async () => {
    const client = await createClient({
      name: 'Cliente HU01-03',
      email: 'cli.hu0103@test.local',
    });

    const res = await api('/availability?date=2030-05-06', { headers: client.headers });
    assert.equal(res.status, 400);
    assert.match(String(res.data?.error ?? res.data?.message ?? ''), /serviceId/i);
  });

  it('TC-HU01-04: horario 09:00-13:00 con servicio de 60 min ofrece 12:00 y no ofrece 12:30', async () => {
    // 2030-05-07 is Tuesday (dayOfWeek = 2)
    const date = '2030-05-07';
    const pro = await createPro({
      name: 'Pro HU01-04',
      email: 'pro.hu0104@test.local',
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '13:00' }],
    });

    const res = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(res.status, 200);
    const slots = extractSlotsForProfessional(res.data, pro.id);
    assert.ok(slots.includes(`${date}T12:00`), 'Debe incluir 12:00 (termina exactamente a 13:00)');
    assert.ok(!slots.includes(`${date}T12:30`), 'No debe ofrecer 12:30 (excede 13:00)');
    assert.ok(!slots.includes(`${date}T13:00`), 'No debe ofrecer 13:00');
  });

  // ---------------------------------------------------------------------------
  // HU-02 — Reserva online (cualquier profesional)
  // ---------------------------------------------------------------------------

  it('TC-HU02-02: cliente consulta con cualquier profesional y reserva asociando el profesional del slot elegido', async () => {
    const date = '2030-06-04'; // Tuesday (2)
    const svc = (
      await api('/services', {
        method: 'POST',
        headers: adminHeaders,
        body: { name: 'Servicio HU02-02', durationMinutes: 60, priceMinorUnits: 4500 },
      })
    ).data;
    const pro1 = await createPro({
      name: 'Pro HU02-02 A',
      email: 'pro.hu0202a@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '10:00' }],
      withAccount: false,
    });
    const pro2 = await createPro({
      name: 'Pro HU02-02 B',
      email: 'pro.hu0202b@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 2, startTime: '15:00', endTime: '16:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU02-02',
      email: 'cli.hu0202@test.local',
    });

    const avail = await api(`/availability?serviceId=${svc.id}&date=${date}`, {
      headers: client.headers,
    });
    assert.equal(avail.status, 200);
    const chosenPro = avail.data.professionals.find((p) => p.id === pro2.id);
    assert.ok(chosenPro && chosenPro.slots.length > 0);
    const chosenSlot = chosenPro.slots[0];

    const bookRes = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: {
        professionalId: chosenPro.id,
        serviceId: svc.id,
        startAt: chosenSlot.startAt,
      },
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.data.professionalId, pro2.id);
    assert.notEqual(bookRes.data.professionalId, pro1.id);
    assert.equal(bookRes.data.status, 'PROGRAMADA');
  });

  // ---------------------------------------------------------------------------
  // HU-03 — Reserva por recepción (RECEPTIONIST)
  // ---------------------------------------------------------------------------

  it('TC-HU03-01, TC-HU03-02, TC-HU03-03 y TC-HU03-04: RECEPTIONIST registra cita, sin preferencia profesional, rechaza sin cliente y permite citas consecutivas', async () => {
    const date = '2030-06-05'; // Wednesday (3)
    const receptionist = await createReceptionist({ email: 'recep.hu03@test.local' });
    const svc = (
      await api('/services', {
        method: 'POST',
        headers: adminHeaders,
        body: { name: 'Servicio HU03', durationMinutes: 60, priceMinorUnits: 3500 },
      })
    ).data;
    const pro1 = await createPro({
      name: 'Pro HU03 A',
      email: 'pro.hu03a@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '12:00' }],
      withAccount: false,
    });
    const pro2 = await createPro({
      name: 'Pro HU03 B',
      email: 'pro.hu03b@test.local',
      serviceIds: [svc.id],
      schedules: [{ dayOfWeek: 3, startTime: '14:00', endTime: '16:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU03',
      email: 'cli.hu03@test.local',
      withAccount: false,
    });

    // TC-HU03-01: recepcionista registra cita para cliente existente
    const apt1 = await api('/appointments', {
      method: 'POST',
      headers: receptionist.headers,
      body: {
        clientId: client.id,
        professionalId: pro1.id,
        serviceId: svc.id,
        startAt: `${date}T09:00`,
      },
    });
    assert.equal(apt1.status, 201);
    assert.equal(apt1.data.clientId, client.id);
    assert.equal(apt1.data.professionalId, pro1.id);
    assert.equal(apt1.data.status, 'PROGRAMADA');

    // TC-HU03-02: cliente sin preferencia profesional -> availability sin professionalId y reserva con el profesional del slot
    const availAny = await api(`/availability?serviceId=${svc.id}&date=${date}`, {
      headers: receptionist.headers,
    });
    assert.equal(availAny.status, 200);
    const entryPro2 = availAny.data.professionals.find((p) => p.id === pro2.id);
    assert.ok(entryPro2 && entryPro2.slots.length > 0);
    const aptAny = await api('/appointments', {
      method: 'POST',
      headers: receptionist.headers,
      body: {
        clientId: client.id,
        professionalId: entryPro2.id,
        serviceId: svc.id,
        startAt: entryPro2.slots[0].startAt,
      },
    });
    assert.equal(aptAny.status, 201);
    assert.equal(aptAny.data.professionalId, pro2.id);

    // TC-HU03-03: intento de registrar cita sin cliente seleccionado -> 400 y sin crear documento
    const countBeforeInvalid = await getMongoDb()
      .collection('appointments')
      .countDocuments({ organizationId, professionalId: pro1.id });
    const missingClientRes = await api('/appointments', {
      method: 'POST',
      headers: receptionist.headers,
      body: {
        professionalId: pro1.id,
        serviceId: svc.id,
        startAt: `${date}T10:00`,
      },
    });
    assert.equal(missingClientRes.status, 400);
    const countAfterInvalid = await getMongoDb()
      .collection('appointments')
      .countDocuments({ organizationId, professionalId: pro1.id });
    assert.equal(countAfterInvalid, countBeforeInvalid);

    // TC-HU03-04: citas consecutivas permitidas (10:00-11:00 inmediatamente tras 09:00-10:00)
    const aptConsecutive = await api('/appointments', {
      method: 'POST',
      headers: receptionist.headers,
      body: {
        clientId: client.id,
        professionalId: pro1.id,
        serviceId: svc.id,
        startAt: `${date}T10:00`,
      },
    });
    assert.equal(aptConsecutive.status, 201);
    assert.equal(aptConsecutive.data.startAt, `${date}T10:00`);
    assert.equal(aptConsecutive.data.endAt, `${date}T11:00`);
  });

  // ---------------------------------------------------------------------------
  // HU-04 — Profesional visualiza su agenda con clientName sin abrir /clients
  // ---------------------------------------------------------------------------

  it('TC-HU04-01: /me/professional/appointments incluye clientName propio, aísla nombres exclusivos de otro profesional, conserva cliente desactivado y /clients sigue 403', async () => {
    // 2030-05-08 is Wednesday (dayOfWeek = 3)
    const date = '2030-05-08';
    const proA = await createPro({
      name: 'Pro HU04 A',
      email: 'pro.hu04a@test.local',
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '15:00' }],
    });
    const proB = await createPro({
      name: 'Pro HU04 B',
      email: 'pro.hu04b@test.local',
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '15:00' }],
    });
    const activeClientA = await createClient({
      name: 'Ana Activa',
      email: 'ana.hu04@test.local',
      withAccount: false,
    });
    const inactiveClientA = await createClient({
      name: 'Carlos Histórico',
      email: 'carlos.hu04@test.local',
      withAccount: false,
    });
    // Cliente exclusivo de Profesional B que Profesional A nunca atiende
    const exclusiveClientB = await createClient({
      name: 'Berta Exclusiva B',
      email: 'berta.hu04@test.local',
      withAccount: false,
    });

    const aptA1 = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: activeClientA.id,
        professionalId: proA.id,
        serviceId: mainService.id,
        startAt: `${date}T09:00`,
      },
    });
    assert.equal(aptA1.status, 201);

    const aptA2 = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: inactiveClientA.id,
        professionalId: proA.id,
        serviceId: mainService.id,
        startAt: `${date}T10:00`,
      },
    });
    assert.equal(aptA2.status, 201);

    const aptB = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: exclusiveClientB.id,
        professionalId: proB.id,
        serviceId: mainService.id,
        startAt: `${date}T09:00`,
      },
    });
    assert.equal(aptB.status, 201);

    // Desactivar cliente histórico: su cita debe conservar el nombre
    const deactivateRes = await api(`/clients/${inactiveClientA.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.ok(deactivateRes.status === 200 || deactivateRes.status === 204);

    // Profesional A consulta su agenda
    const agendaRes = await api(`/me/professional/appointments?from=${date}&to=${date}`, {
      headers: proA.headers,
    });
    assert.equal(agendaRes.status, 200);
    const list = agendaRes.data.appointments;
    assert.equal(list.length, 2);
    assert.ok(list.every((a) => a.professionalId === proA.id));
    assert.ok(!list.some((a) => a.id === aptB.data.id), 'No debe ver citas de otro profesional');
    assert.ok(
      !JSON.stringify(list).includes('Berta Exclusiva B'),
      'No debe filtrar nombres de clientes exclusivos de otro profesional'
    );

    const byId = new Map(list.map((a) => [a.id, a]));
    assert.equal(byId.get(aptA1.data.id).clientName, 'Ana Activa');
    assert.equal(byId.get(aptA2.data.id).clientName, 'Carlos Histórico');

    // Verificar ausencia de campos personales innecesarios (email/phone)
    assert.equal(byId.get(aptA1.data.id).clientEmail, undefined);
    assert.equal(byId.get(aptA1.data.id).clientPhone, undefined);

    // GET /api/v1/clients debe seguir bloqueado con 403 para PROFESSIONAL
    const clientsRes = await api('/clients', { headers: proA.headers });
    assert.equal(clientsRes.status, 403);
  });

  it('TC-HU04-04: profesional consulta mes sin citas y recibe lista vacía', async () => {
    const pro = await createPro({
      name: 'Pro HU04-04 Vacío',
      email: 'pro.hu0404@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
    });

    const res = await api('/me/professional/appointments?from=2031-08-01&to=2031-08-31', {
      headers: pro.headers,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.appointments, []);
  });

  // ---------------------------------------------------------------------------
  // HU-05 — Borde exacto de finalización (unit test de dominio)
  // ---------------------------------------------------------------------------

  it('TC-HU05-04: assertAppointmentHasEndedAt permite now === endAt y rechaza now < endAt con 409', () => {
    const appointment = { end_at: '2030-05-06T10:00' };

    assert.doesNotThrow(() => {
      assertAppointmentHasEndedAt(appointment, '2030-05-06T10:00');
    });

    assert.throws(
      () => assertAppointmentHasEndedAt(appointment, '2030-05-06T09:59'),
      (err) => err?.statusCode === 409 && /no ha terminado/i.test(err?.message ?? '')
    );
  });

  // ---------------------------------------------------------------------------
  // HU-06 — Notificaciones internas del cliente, aislamiento e inbox vacío
  // ---------------------------------------------------------------------------

  it('TC-HU06-01: cada evento de cita genera exactamente 1 notificación no leída para CLIENT (total 4) con destinatario correcto', async () => {
    // 2030-05-09 is Thursday (dayOfWeek = 4)
    const date = '2030-05-09';
    const pro = await createPro({
      name: 'Pro HU06',
      email: 'pro.hu06@test.local',
      schedules: [{ dayOfWeek: 4, startTime: '09:00', endTime: '15:00' }],
    });
    const client = await createClient({
      name: 'Cliente HU06',
      email: 'cli.hu06@test.local',
    });
    const otherClient = await createClient({
      name: 'Cliente HU06 Otro',
      email: 'cli.hu06.other@test.local',
    });

    async function getClientInbox() {
      const r = await api('/me/notifications', { headers: client.headers });
      assert.equal(r.status, 200);
      return r.data.notifications;
    }

    // 1. CREATE -> +1 APPOINTMENT_CREATED
    const beforeCreate = await getClientInbox();
    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);
    const appointmentId = created.data.id;

    const afterCreate = await getClientInbox();
    assert.equal(afterCreate.length, beforeCreate.length + 1);
    const createdDiff = afterCreate.filter((n) => !beforeCreate.some((b) => b.id === n.id));
    assert.equal(createdDiff.length, 1);
    assert.equal(createdDiff[0].appointmentId, appointmentId);
    assert.equal(createdDiff[0].type, 'APPOINTMENT_CREATED');
    assert.equal(createdDiff[0].isRead, false);
    assert.equal(createdDiff[0].readAt, null);

    // 2. CONFIRM -> +1 APPOINTMENT_CONFIRMED
    const confirmed = await api(`/appointments/${appointmentId}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(confirmed.status, 200);

    const afterConfirm = await getClientInbox();
    assert.equal(afterConfirm.length, afterCreate.length + 1);
    const confirmDiff = afterConfirm.filter((n) => !afterCreate.some((b) => b.id === n.id));
    assert.equal(confirmDiff.length, 1);
    assert.equal(confirmDiff[0].appointmentId, appointmentId);
    assert.equal(confirmDiff[0].type, 'APPOINTMENT_CONFIRMED');
    assert.equal(confirmDiff[0].isRead, false);
    assert.equal(confirmDiff[0].readAt, null);

    // 3. RESCHEDULE -> +1 APPOINTMENT_RESCHEDULED
    const rescheduled = await api(`/me/client/appointments/${appointmentId}/reschedule`, {
      method: 'PATCH',
      headers: client.headers,
      body: { startAt: `${date}T11:00` },
    });
    assert.equal(rescheduled.status, 200);

    const afterReschedule = await getClientInbox();
    assert.equal(afterReschedule.length, afterConfirm.length + 1);
    const reschedDiff = afterReschedule.filter((n) => !afterConfirm.some((b) => b.id === n.id));
    assert.equal(reschedDiff.length, 1);
    assert.equal(reschedDiff[0].appointmentId, appointmentId);
    assert.equal(reschedDiff[0].type, 'APPOINTMENT_RESCHEDULED');
    assert.equal(reschedDiff[0].isRead, false);
    assert.equal(reschedDiff[0].readAt, null);

    // 4. CANCEL -> +1 APPOINTMENT_CANCELLED
    const cancelled = await api(`/me/client/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(cancelled.status, 200);

    const afterCancel = await getClientInbox();
    assert.equal(afterCancel.length, afterReschedule.length + 1);
    const cancelDiff = afterCancel.filter((n) => !afterReschedule.some((b) => b.id === n.id));
    assert.equal(cancelDiff.length, 1);
    assert.equal(cancelDiff[0].appointmentId, appointmentId);
    assert.equal(cancelDiff[0].type, 'APPOINTMENT_CANCELLED');
    assert.equal(cancelDiff[0].isRead, false);
    assert.equal(cancelDiff[0].readAt, null);

    // Total exacto de 4 notificaciones para este Appointment
    const mine = afterCancel.filter((n) => n.appointmentId === appointmentId);
    assert.equal(mine.length, 4);
    assert.deepEqual(
      mine.map((n) => n.type).sort(),
      [
        'APPOINTMENT_CANCELLED',
        'APPOINTMENT_CONFIRMED',
        'APPOINTMENT_CREATED',
        'APPOINTMENT_RESCHEDULED',
      ]
    );

    // Ausencia en el inbox de otro cliente
    const otherInbox = await api('/me/notifications', { headers: otherClient.headers });
    assert.equal(otherInbox.status, 200);
    assert.equal(
      otherInbox.data.notifications.filter((n) => n.appointmentId === appointmentId).length,
      0
    );

    // Verificación tenant-scoped en MongoDB del destinatario (sin exponerlo en la API pública)
    const dbDocs = await getMongoDb()
      .collection('notifications')
      .find({
        organizationId,
        recipientUserAccountId: client.userAccountId,
        appointmentId,
      })
      .toArray();
    assert.equal(dbDocs.length, 4);
  });

  it('TC-HU06-03: cliente B no ve notificación de A, recibe 404 sin filtrar datos y notificación de A queda intacta', async () => {
    const date = '2030-05-10'; // Friday (5)
    const pro = await createPro({
      name: 'Pro HU06-03',
      email: 'pro.hu0603@test.local',
      schedules: [{ dayOfWeek: 5, startTime: '09:00', endTime: '13:00' }],
    });
    const clientA = await createClient({ name: 'Cliente A', email: 'cli.a.hu0603@test.local' });
    const clientB = await createClient({ name: 'Cliente B', email: 'cli.b.hu0603@test.local' });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: clientA.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    const listA = await api('/me/notifications', { headers: clientA.headers });
    assert.equal(listA.status, 200);
    const targetNotif = listA.data.notifications.find((n) => n.appointmentId === created.data.id);
    assert.ok(targetNotif);

    // Inbox de cliente B no debe contener notificationA
    const listB = await api('/me/notifications', { headers: clientB.headers });
    assert.equal(listB.status, 200);
    assert.ok(!listB.data.notifications.some((n) => n.id === targetNotif.id));

    // PATCH de cliente B -> 404 sin exponer title, message ni appointmentId de A
    const crossPatch = await api(`/me/notifications/${targetNotif.id}`, {
      method: 'PATCH',
      headers: clientB.headers,
      body: { isRead: true },
    });
    assert.equal(crossPatch.status, 404);
    const raw404 = JSON.stringify(crossPatch.data);
    assert.ok(!raw404.includes(targetNotif.title));
    assert.ok(!raw404.includes(targetNotif.message));
    assert.ok(!raw404.includes(targetNotif.appointmentId));

    // Notificación de cliente A permanece intacta
    const listAAfter = await api('/me/notifications', { headers: clientA.headers });
    const stillUnread = listAAfter.data.notifications.find((n) => n.id === targetNotif.id);
    assert.equal(stillUnread.isRead, false);
    assert.equal(stillUnread.readAt, null);
    assert.equal(stillUnread.title, targetNotif.title);
    assert.equal(stillUnread.message, targetNotif.message);
  });

  it('TC-HU06-04: cliente sin eventos tiene inbox vacío (notifications: [], unreadCount: 0)', async () => {
    const freshClient = await createClient({
      name: 'Cliente Sin Notif',
      email: 'cli.empty.hu0604@test.local',
    });

    const res = await api('/me/notifications', { headers: freshClient.headers });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.notifications, []);
    assert.equal(res.data.unreadCount, 0);
  });

  // ---------------------------------------------------------------------------
  // HU-07 — Asignación de servicios a profesionales
  // ---------------------------------------------------------------------------

  it('TC-HU07-03: asignar un servicio inactivo a un profesional retorna 409 y no lo agrega a sus servicios', async () => {
    const pro = await createPro({
      name: 'Pro HU07-03',
      email: 'pro.hu0703@test.local',
      serviceIds: [],
      withAccount: false,
    });

    const svcRes = await api('/services', {
      method: 'POST',
      headers: adminHeaders,
      body: { name: 'Servicio Inactivo 30B', durationMinutes: 30, priceMinorUnits: 2000 },
    });
    assert.equal(svcRes.status, 201);

    const delRes = await api(`/services/${svcRes.data.id}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.ok(delRes.status === 200 || delRes.status === 204);

    const assignRes = await api(`/professionals/${pro.id}/services`, {
      method: 'POST',
      headers: adminHeaders,
      body: { serviceId: svcRes.data.id },
    });
    assert.equal(assignRes.status, 409);

    const assignedAfter = await api(`/professionals/${pro.id}/services`, {
      headers: adminHeaders,
    });
    assert.equal(assignedAfter.status, 200);
    assert.ok(!assignedAfter.data.services.some((s) => s.id === svcRes.data.id));
    assert.equal(assignedAfter.data.services.length, 0);
  });

  it('TC-HU07-04: asignar un servicio ya asignado retorna 409 y conserva exactamente 1 registro', async () => {
    const pro = await createPro({
      name: 'Pro HU07-04',
      email: 'pro.hu0704@test.local',
      serviceIds: [mainService.id],
      withAccount: false,
    });

    const duplicateRes = await api(`/professionals/${pro.id}/services`, {
      method: 'POST',
      headers: adminHeaders,
      body: { serviceId: mainService.id },
    });
    assert.equal(duplicateRes.status, 409);

    const assignedAfter = await api(`/professionals/${pro.id}/services`, {
      headers: adminHeaders,
    });
    assert.equal(assignedAfter.status, 200);
    const matching = assignedAfter.data.services.filter((s) => s.id === mainService.id);
    assert.equal(matching.length, 1);
  });

  // ---------------------------------------------------------------------------
  // HU-08 — Horarios semanales (disjuntos, solapados, contiguos)
  // ---------------------------------------------------------------------------

  it('TC-HU08-02: dos bloques disjuntos (09:00-13:00 y 14:00-18:00) excluyen 12:30, 13:00 y 13:30 y ningún intervalo cruza el descanso', async () => {
    // 2030-05-13 is Monday (1)
    const date = '2030-05-13';
    const pro = await createPro({
      name: 'Pro HU08-02',
      email: 'pro.hu0802@test.local',
      schedules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
      ],
      withAccount: false,
    });

    const avail = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(avail.status, 200);
    const slotObjs = extractSlotObjectsForProfessional(avail.data, pro.id);
    const starts = slotObjs.map((s) => s.startAt);

    assert.ok(starts.includes(`${date}T09:00`));
    assert.ok(starts.includes(`${date}T12:00`));
    assert.ok(!starts.includes(`${date}T12:30`), '12:30-13:30 cruza el descanso');
    assert.ok(!starts.includes(`${date}T13:00`), '13:00-14:00 está en el descanso');
    assert.ok(!starts.includes(`${date}T13:30`), '13:30-14:30 cruza el descanso');
    assert.ok(starts.includes(`${date}T14:00`));
    assert.ok(starts.includes(`${date}T17:00`));

    // Ningún intervalo ofrecido puede intersectar (13:00, 14:00)
    const breakStart = `${date}T13:00`;
    const breakEnd = `${date}T14:00`;
    for (const slot of slotObjs) {
      assert.ok(typeof slot.startAt === 'string' && typeof slot.endAt === 'string');
      assert.ok(
        slot.endAt <= breakStart || slot.startAt >= breakEnd,
        `Slot ${slot.startAt}-${slot.endAt} no debe cruzar el descanso 13:00-14:00`
      );
    }
  });

  it('TC-HU08-03: horario solapado en el mismo día (12:00-15:00 sobre 09:00-13:00) retorna 409 y conserva solo el rango original', async () => {
    const pro = await createPro({
      name: 'Pro HU08-03',
      email: 'pro.hu0803@test.local',
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '13:00' }],
      withAccount: false,
    });

    const overlapRes = await api(`/professionals/${pro.id}/schedules`, {
      method: 'POST',
      headers: adminHeaders,
      body: { dayOfWeek: 2, startTime: '12:00', endTime: '15:00' },
    });
    assert.equal(overlapRes.status, 409);

    const listRes = await api(`/professionals/${pro.id}/schedules`, { headers: adminHeaders });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.schedules.length, 1);
    assert.equal(listRes.data.schedules[0].startTime, '09:00');
    assert.equal(listRes.data.schedules[0].endTime, '13:00');
  });

  it('TC-HU08-04: horarios contiguos (09:00-13:00 y 13:00-17:00) en el mismo día se permiten (201) y persisten ambos rangos', async () => {
    const pro = await createPro({
      name: 'Pro HU08-04',
      email: 'pro.hu0804@test.local',
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '13:00' }],
      withAccount: false,
    });

    const contiguousRes = await api(`/professionals/${pro.id}/schedules`, {
      method: 'POST',
      headers: adminHeaders,
      body: { dayOfWeek: 3, startTime: '13:00', endTime: '17:00' },
    });
    assert.equal(contiguousRes.status, 201);

    const listRes = await api(`/professionals/${pro.id}/schedules`, { headers: adminHeaders });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.schedules.length, 2);
    const ranges = listRes.data.schedules
      .map((s) => `${s.startTime}-${s.endTime}`)
      .sort();
    assert.deepEqual(ranges, ['09:00-13:00', '13:00-17:00']);
  });

  // ---------------------------------------------------------------------------
  // HU-09 — Bloqueos excepcionales (simple, multi-día y consecutivos)
  // ---------------------------------------------------------------------------

  it('TC-HU09-01: bloqueo excepcional excluye todos los slots solapados (incluidos parciales) comparando disponibilidad antes y después', async () => {
    // 2030-05-14 is Tuesday (2)
    const date = '2030-05-14';
    const pro = await createPro({
      name: 'Pro HU09-01',
      email: 'pro.hu0901@test.local',
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '13:00' }],
    });

    const beforeAvail = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(beforeAvail.status, 200);
    assert.deepEqual(extractSlotsForProfessional(beforeAvail.data, pro.id), [
      `${date}T09:00`,
      `${date}T09:30`,
      `${date}T10:00`,
      `${date}T10:30`,
      `${date}T11:00`,
      `${date}T11:30`,
      `${date}T12:00`,
    ]);

    const blockRes = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: pro.headers,
      body: { startAt: `${date}T10:00`, endAt: `${date}T12:00`, reason: 'Reunión clínica' },
    });
    assert.equal(blockRes.status, 201);

    const afterAvail = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(afterAvail.status, 200);
    // 09:30-10:30 y 11:30-12:30 son solapamientos parciales y también deben excluirse
    assert.deepEqual(extractSlotsForProfessional(afterAvail.data, pro.id), [
      `${date}T09:00`,
      `${date}T12:00`,
    ]);
  });

  it('TC-HU09-02: bloqueo multi-día (2026-10-21T18:00 a 2026-10-23T09:00) afecta días 21, 22 y 23 con 1 solo documento y respeta adyacencia', async () => {
    // 2026-10-21 = Wed (3), 2026-10-22 = Thu (4), 2026-10-23 = Fri (5)
    const pro = await createPro({
      name: 'Pro HU09-02',
      email: 'pro.hu0902@test.local',
      schedules: [
        { dayOfWeek: 3, startTime: '08:00', endTime: '20:00' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '20:00' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '20:00' },
      ],
    });

    const blockRes = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: pro.headers,
      body: {
        startAt: '2026-10-21T18:00',
        endAt: '2026-10-23T09:00',
        reason: 'Congreso multi-día',
      },
    });
    assert.equal(blockRes.status, 201);

    // Verificar exactamente 1 documento persistido (tenant-scoped)
    const docCount = await getMongoDb()
      .collection('availabilityBlocks')
      .countDocuments({ organizationId, professionalId: pro.id });
    assert.equal(docCount, 1);

    // Día 21: 17:00-18:00 disponible (adyacente), 17:30 (parcial), 18:00, 18:30, 19:00 bloqueados
    const day21 = await api(
      `/availability?serviceId=${mainService.id}&date=2026-10-21&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(day21.status, 200);
    const slots21 = extractSlotsForProfessional(day21.data, pro.id);
    assert.ok(slots21.includes('2026-10-21T17:00'));
    assert.ok(!slots21.includes('2026-10-21T17:30'));
    assert.ok(!slots21.includes('2026-10-21T18:00'));
    assert.ok(!slots21.includes('2026-10-21T18:30'));
    assert.ok(!slots21.includes('2026-10-21T19:00'));

    // Día 22: completamente bloqueado
    const day22 = await api(
      `/availability?serviceId=${mainService.id}&date=2026-10-22&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(day22.status, 200);
    assert.deepEqual(extractSlotsForProfessional(day22.data, pro.id), []);

    // Día 23: 08:00 y 08:30 bloqueados, 09:00-10:00 disponible (adyacencia exacta al finalizar bloqueo)
    const day23 = await api(
      `/availability?serviceId=${mainService.id}&date=2026-10-23&professionalId=${pro.id}`,
      { headers: adminHeaders }
    );
    assert.equal(day23.status, 200);
    const slots23 = extractSlotsForProfessional(day23.data, pro.id);
    assert.ok(!slots23.includes('2026-10-23T08:00'));
    assert.ok(!slots23.includes('2026-10-23T08:30'));
    assert.ok(slots23.includes('2026-10-23T09:00'));
  });

  it('TC-HU09-04: bloqueos excepcionales consecutivos (10:00-12:00 y 12:00-14:00) son permitidos', async () => {
    const date = '2030-06-06'; // Thursday (4)
    const pro = await createPro({
      name: 'Pro HU09-04',
      email: 'pro.hu0904@test.local',
      schedules: [{ dayOfWeek: 4, startTime: '09:00', endTime: '17:00' }],
    });

    const b1 = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: pro.headers,
      body: { startAt: `${date}T10:00`, endAt: `${date}T12:00`, reason: 'Bloqueo 1' },
    });
    assert.equal(b1.status, 201);

    const b2 = await api('/me/professional/availability-blocks', {
      method: 'POST',
      headers: pro.headers,
      body: { startAt: `${date}T12:00`, endAt: `${date}T14:00`, reason: 'Bloqueo 2' },
    });
    assert.equal(b2.status, 201);

    const count = await getMongoDb()
      .collection('availabilityBlocks')
      .countDocuments({ organizationId, professionalId: pro.id });
    assert.equal(count, 2);
  });

  // ---------------------------------------------------------------------------
  // HU-10 — Confirmación de citas (ciclo, estados terminales, idempotencia)
  // ---------------------------------------------------------------------------

  it('TC-HU10-02: flujo create -> confirm -> reschedule (PROGRAMADA) -> confirm (CONFIRMADA) conserva ID y recursos', async () => {
    const date = '2030-05-15'; // Wednesday (3)
    const pro = await createPro({
      name: 'Pro HU10-02',
      email: 'pro.hu1002@test.local',
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '14:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU10-02',
      email: 'cli.hu1002@test.local',
      withAccount: false,
    });

    const created = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: client.id,
        professionalId: pro.id,
        serviceId: mainService.id,
        startAt: `${date}T09:00`,
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'PROGRAMADA');

    const confirmed1 = await api(`/appointments/${created.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(confirmed1.status, 200);
    assert.equal(confirmed1.data.status, 'CONFIRMADA');

    const rescheduled = await api(`/appointments/${created.data.id}/reschedule`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { startAt: `${date}T11:00` },
    });
    assert.equal(rescheduled.status, 200);
    assert.equal(rescheduled.data.status, 'PROGRAMADA');

    const confirmed2 = await api(`/appointments/${created.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(confirmed2.status, 200);
    assert.equal(confirmed2.data.status, 'CONFIRMADA');
    assert.equal(confirmed2.data.id, created.data.id);
    assert.equal(confirmed2.data.startAt, `${date}T11:00`);
    assert.equal(confirmed2.data.endAt, `${date}T12:00`);
    assert.equal(confirmed2.data.clientId, client.id);
    assert.equal(confirmed2.data.professionalId, pro.id);
    assert.equal(confirmed2.data.serviceId, mainService.id);
  });

  it('TC-HU10-03: confirmar cita en CANCELADA, COMPLETADA o NO_ASISTIO retorna 409 sin alterar la cita', async () => {
    const pastDate = '2026-01-05'; // Monday (1)
    const pro = await createPro({
      name: 'Pro HU10-03',
      email: 'pro.hu1003@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '15:00' }],
    });
    const client = await createClient({
      name: 'Cliente HU10-03',
      email: 'cli.hu1003@test.local',
      withAccount: false,
    });

    const aptCancel = (
      await api('/appointments', {
        method: 'POST',
        headers: adminHeaders,
        body: {
          clientId: client.id,
          professionalId: pro.id,
          serviceId: mainService.id,
          startAt: `${pastDate}T09:00`,
        },
      })
    ).data;
    const aptComplete = (
      await api('/appointments', {
        method: 'POST',
        headers: adminHeaders,
        body: {
          clientId: client.id,
          professionalId: pro.id,
          serviceId: mainService.id,
          startAt: `${pastDate}T10:00`,
        },
      })
    ).data;
    const aptNoShow = (
      await api('/appointments', {
        method: 'POST',
        headers: adminHeaders,
        body: {
          clientId: client.id,
          professionalId: pro.id,
          serviceId: mainService.id,
          startAt: `${pastDate}T11:00`,
        },
      })
    ).data;

    assert.equal(
      (await api(`/appointments/${aptCancel.id}/cancel`, { method: 'PATCH', headers: adminHeaders })).status,
      200
    );
    assert.equal(
      (await api(`/me/professional/appointments/${aptComplete.id}/complete`, { method: 'PATCH', headers: pro.headers })).status,
      200
    );
    assert.equal(
      (await api(`/me/professional/appointments/${aptNoShow.id}/no-show`, { method: 'PATCH', headers: pro.headers })).status,
      200
    );

    for (const aptId of [aptCancel.id, aptComplete.id, aptNoShow.id]) {
      const before = (await api(`/appointments/${aptId}`, { headers: adminHeaders })).data;
      const attempt = await api(`/appointments/${aptId}/confirm`, {
        method: 'PATCH',
        headers: adminHeaders,
      });
      assert.equal(attempt.status, 409);
      const after = (await api(`/appointments/${aptId}`, { headers: adminHeaders })).data;
      assert.deepEqual(after, before);
    }
  });

  it('TC-HU10-04: confirmar dos veces es idempotente (200 CONFIRMADA), no altera updatedAt ni duplica registros o notificaciones', async () => {
    const date = '2030-05-16'; // Thursday (4)
    const pro = await createPro({
      name: 'Pro HU10-04',
      email: 'pro.hu1004@test.local',
      schedules: [{ dayOfWeek: 4, startTime: '09:00', endTime: '12:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU10-04',
      email: 'cli.hu1004@test.local',
    });

    const created = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: client.id,
        professionalId: pro.id,
        serviceId: mainService.id,
        startAt: `${date}T09:00`,
      },
    });
    assert.equal(created.status, 201);

    const first = await api(`/appointments/${created.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.status, 'CONFIRMADA');

    const second = await api(`/appointments/${created.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.status, 'CONFIRMADA');
    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.clientId, client.id);
    assert.equal(second.data.professionalId, pro.id);
    assert.equal(second.data.serviceId, mainService.id);
    assert.equal(second.data.startAt, first.data.startAt);
    assert.equal(second.data.endAt, first.data.endAt);
    assert.equal(second.data.updatedAt, first.data.updatedAt);

    const aptCount = await getMongoDb()
      .collection('appointments')
      .countDocuments({ organizationId, clientId: client.id });
    assert.equal(aptCount, 1);

    const confirmNotifCount = await getMongoDb()
      .collection('notifications')
      .countDocuments({
        organizationId,
        appointmentId: created.data.id,
        type: 'APPOINTMENT_CONFIRMED',
      });
    assert.equal(confirmNotifCount, 1);
  });

  // ---------------------------------------------------------------------------
  // HU-11 — Reprogramación de citas
  // ---------------------------------------------------------------------------

  it('TC-HU11-01: cliente reprograma vía /me/client/appointments/:id/reschedule, conserva ID/recursos y libera slot anterior', async () => {
    const date = '2030-05-17'; // Friday (5)
    const pro = await createPro({
      name: 'Pro HU11-01',
      email: 'pro.hu1101@test.local',
      schedules: [{ dayOfWeek: 5, startTime: '09:00', endTime: '13:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU11-01',
      email: 'cli.hu1101@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    // Comprobar ocupación del slot original antes de reprogramar
    const availBefore = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availBefore.status, 200);
    assert.ok(!extractSlotsForProfessional(availBefore.data, pro.id).includes(`${date}T09:00`));

    const rescheduled = await api(`/me/client/appointments/${created.data.id}/reschedule`, {
      method: 'PATCH',
      headers: client.headers,
      body: { startAt: `${date}T11:00` },
    });
    assert.equal(rescheduled.status, 200);
    assert.equal(rescheduled.data.id, created.data.id);
    assert.equal(rescheduled.data.status, 'PROGRAMADA');
    assert.equal(rescheduled.data.startAt, `${date}T11:00`);
    assert.equal(rescheduled.data.endAt, `${date}T12:00`);
    assert.equal(rescheduled.data.clientId, client.id);
    assert.equal(rescheduled.data.professionalId, pro.id);
    assert.equal(rescheduled.data.serviceId, mainService.id);

    const availAfter = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availAfter.status, 200);
    const slots = extractSlotsForProfessional(availAfter.data, pro.id);
    assert.ok(slots.includes(`${date}T09:00`), 'El slot anterior 09:00 debe quedar libre');
    assert.ok(!slots.includes(`${date}T11:00`), 'El nuevo slot 11:00 debe quedar ocupado');
  });

  it('TC-HU11-02: reprogramar a otra fecha conserva ID, cliente, servicio y profesional', async () => {
    const date1 = '2030-06-10'; // Monday (1)
    const date2 = '2030-06-11'; // Tuesday (2)
    const pro = await createPro({
      name: 'Pro HU11-02',
      email: 'pro.hu1102@test.local',
      schedules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 2, startTime: '14:00', endTime: '17:00' },
      ],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU11-02',
      email: 'cli.hu1102@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date1}T09:00` },
    });
    assert.equal(created.status, 201);

    const res = await api(`/me/client/appointments/${created.data.id}/reschedule`, {
      method: 'PATCH',
      headers: client.headers,
      body: { startAt: `${date2}T15:00` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.id, created.data.id);
    assert.equal(res.data.startAt, `${date2}T15:00`);
    assert.equal(res.data.endAt, `${date2}T16:00`);
    assert.equal(res.data.clientId, client.id);
    assert.equal(res.data.professionalId, pro.id);
    assert.equal(res.data.serviceId, mainService.id);
  });

  it('TC-HU11-04: reprogramar al bloque inmediatamente consecutivo (15:00 tras 14:00-15:00) retorna 200 y ambas citas persisten sin solaparse', async () => {
    const date = '2030-05-20'; // Monday (1)
    const pro = await createPro({
      name: 'Pro HU11-04',
      email: 'pro.hu1104@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '10:00', endTime: '18:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU11-04',
      email: 'cli.hu1104@test.local',
    });

    const existing = await api('/appointments', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        clientId: client.id,
        professionalId: pro.id,
        serviceId: mainService.id,
        startAt: `${date}T14:00`,
      },
    });
    assert.equal(existing.status, 201);

    const movable = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T10:00` },
    });
    assert.equal(movable.status, 201);

    const res = await api(`/me/client/appointments/${movable.data.id}/reschedule`, {
      method: 'PATCH',
      headers: client.headers,
      body: { startAt: `${date}T15:00` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.id, movable.data.id);
    assert.equal(res.data.status, 'PROGRAMADA');
    assert.equal(res.data.startAt, `${date}T15:00`);
    assert.equal(res.data.endAt, `${date}T16:00`);

    const persisted = await api(`/appointments?professionalId=${pro.id}&from=${date}&to=${date}`, {
      headers: adminHeaders,
    });
    assert.equal(persisted.status, 200);
    assert.equal(persisted.data.appointments.length, 2);
    const intervals = persisted.data.appointments
      .map((a) => `${a.startAt}->${a.endAt}`)
      .sort();
    assert.deepEqual(intervals, [
      `${date}T14:00->${date}T15:00`,
      `${date}T15:00->${date}T16:00`,
    ]);
  });

  // ---------------------------------------------------------------------------
  // HU-12 — Cancelación de citas (PROGRAMADA, CONFIRMADA, terminales, idempotente)
  // ---------------------------------------------------------------------------

  it('TC-HU12-01: cancelar cita PROGRAMADA vía endpoint self CLIENT libera disponibilidad y conserva historial', async () => {
    const date = '2030-05-21'; // Tuesday (2)
    const pro = await createPro({
      name: 'Pro HU12-01',
      email: 'pro.hu1201@test.local',
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '11:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU12-01',
      email: 'cli.hu1201@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    const availBefore = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availBefore.status, 200);
    assert.ok(!extractSlotsForProfessional(availBefore.data, pro.id).includes(`${date}T09:00`));

    const cancelled = await api(`/me/client/appointments/${created.data.id}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.id, created.data.id);
    assert.equal(cancelled.data.status, 'CANCELADA');

    const availAfter = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availAfter.status, 200);
    assert.ok(extractSlotsForProfessional(availAfter.data, pro.id).includes(`${date}T09:00`));

    const history = await api('/me/client/appointments', { headers: client.headers });
    assert.equal(history.status, 200);
    const saved = history.data.appointments.find((a) => a.id === created.data.id);
    assert.ok(saved);
    assert.equal(saved.status, 'CANCELADA');
  });

  it('TC-HU12-02: cancelar cita CONFIRMADA vía endpoint self CLIENT libera disponibilidad y conserva historial', async () => {
    const date = '2030-05-22'; // Wednesday (3)
    const pro = await createPro({
      name: 'Pro HU12-02',
      email: 'pro.hu1202@test.local',
      schedules: [{ dayOfWeek: 3, startTime: '09:00', endTime: '11:00' }],
      withAccount: false,
    });
    const client = await createClient({
      name: 'Cliente HU12-02',
      email: 'cli.hu1202@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    const confirmed = await api(`/appointments/${created.data.id}/confirm`, {
      method: 'PATCH',
      headers: adminHeaders,
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.status, 'CONFIRMADA');

    const availBefore = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availBefore.status, 200);
    assert.ok(!extractSlotsForProfessional(availBefore.data, pro.id).includes(`${date}T09:00`));

    const cancelled = await api(`/me/client/appointments/${created.data.id}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.id, created.data.id);
    assert.equal(cancelled.data.status, 'CANCELADA');

    const availAfter = await api(
      `/availability?serviceId=${mainService.id}&date=${date}&professionalId=${pro.id}`,
      { headers: client.headers }
    );
    assert.equal(availAfter.status, 200);
    assert.ok(extractSlotsForProfessional(availAfter.data, pro.id).includes(`${date}T09:00`));

    const history = await api('/me/client/appointments', { headers: client.headers });
    assert.equal(history.status, 200);
    const saved = history.data.appointments.find((a) => a.id === created.data.id);
    assert.ok(saved);
    assert.equal(saved.status, 'CANCELADA');
  });

  it('TC-HU12-03: cliente con UserAccount recibe 409 al cancelar COMPLETADA o NO_ASISTIO vía /me/client/appointments/:id/cancel sin alterar datos', async () => {
    const pastDate = '2026-01-06'; // Tuesday (2)
    const pro = await createPro({
      name: 'Pro HU12-03',
      email: 'pro.hu1203@test.local',
      schedules: [{ dayOfWeek: 2, startTime: '09:00', endTime: '14:00' }],
    });
    const client = await createClient({
      name: 'Cliente HU12-03',
      email: 'cli.hu1203@test.local',
      withAccount: true,
    });

    const aptComplete = (
      await api('/me/client/appointments', {
        method: 'POST',
        headers: client.headers,
        body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${pastDate}T09:00` },
      })
    ).data;
    const aptNoShow = (
      await api('/me/client/appointments', {
        method: 'POST',
        headers: client.headers,
        body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${pastDate}T11:00` },
      })
    ).data;

    assert.equal(
      (await api(`/me/professional/appointments/${aptComplete.id}/complete`, { method: 'PATCH', headers: pro.headers })).status,
      200
    );
    assert.equal(
      (await api(`/me/professional/appointments/${aptNoShow.id}/no-show`, { method: 'PATCH', headers: pro.headers })).status,
      200
    );

    for (const aptId of [aptComplete.id, aptNoShow.id]) {
      const before = (await api(`/appointments/${aptId}`, { headers: adminHeaders })).data;
      const attempt = await api(`/me/client/appointments/${aptId}/cancel`, {
        method: 'PATCH',
        headers: client.headers,
      });
      assert.equal(attempt.status, 409);
      const after = (await api(`/appointments/${aptId}`, { headers: adminHeaders })).data;
      assert.deepEqual(after, before);
    }
  });

  it('TC-HU12-04: doble cancelación es idempotente (200 CANCELADA), no altera updatedAt, sin duplicados ni notificación adicional', async () => {
    const date = '2030-05-23'; // Thursday (4)
    const pro = await createPro({
      name: 'Pro HU12-04',
      email: 'pro.hu1204@test.local',
      schedules: [{ dayOfWeek: 4, startTime: '09:00', endTime: '12:00' }],
      withAccount: false,
    });
    // Cliente aislado creado exclusivamente para este test
    const client = await createClient({
      name: 'Cliente HU12-04 Aislado',
      email: 'cli.hu1204.isolated@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    const first = await api(`/me/client/appointments/${created.data.id}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.status, 'CANCELADA');

    const second = await api(`/me/client/appointments/${created.data.id}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.status, 'CANCELADA');
    assert.equal(second.data.id, first.data.id);
    assert.equal(second.data.startAt, first.data.startAt);
    assert.equal(second.data.endAt, first.data.endAt);
    assert.equal(second.data.updatedAt, first.data.updatedAt);

    // Conteo tenant-scoped por organizationId + clientId (detecta duplicados incluso con distinto UUID)
    const docCount = await getMongoDb()
      .collection('appointments')
      .countDocuments({ organizationId, clientId: client.id });
    assert.equal(docCount, 1);

    // Sin notificación adicional de cancelación
    const cancelNotifCount = await getMongoDb()
      .collection('notifications')
      .countDocuments({
        organizationId,
        recipientUserAccountId: client.userAccountId,
        appointmentId: created.data.id,
        type: 'APPOINTMENT_CANCELLED',
      });
    assert.equal(cancelNotifCount, 1);
  });

  // ---------------------------------------------------------------------------
  // HU-13 — Notificaciones del profesional (eventos, lectura idempotente e inbox vacío)
  // ---------------------------------------------------------------------------

  it('TC-HU13-01: cada evento de agenda genera exactamente 1 notificación no leída para PROFESSIONAL (total 3) con destinatario correcto', async () => {
    const date = '2030-05-24'; // Friday (5)
    const pro = await createPro({
      name: 'Pro HU13-01',
      email: 'pro.hu1301@test.local',
      schedules: [{ dayOfWeek: 5, startTime: '09:00', endTime: '15:00' }],
    });
    const otherPro = await createPro({
      name: 'Pro HU13-01 Otro',
      email: 'pro.hu1301.other@test.local',
      schedules: [{ dayOfWeek: 5, startTime: '09:00', endTime: '15:00' }],
    });
    const client = await createClient({
      name: 'Cliente HU13-01',
      email: 'cli.hu1301@test.local',
    });

    async function getProInbox() {
      const r = await api('/me/notifications', { headers: pro.headers });
      assert.equal(r.status, 200);
      return r.data.notifications;
    }

    // 1. CREATE -> +1 APPOINTMENT_ASSIGNED
    const beforeCreate = await getProInbox();
    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);
    const appointmentId = created.data.id;

    const afterCreate = await getProInbox();
    assert.equal(afterCreate.length, beforeCreate.length + 1);
    const assignDiff = afterCreate.filter((n) => !beforeCreate.some((b) => b.id === n.id));
    assert.equal(assignDiff.length, 1);
    assert.equal(assignDiff[0].appointmentId, appointmentId);
    assert.equal(assignDiff[0].type, 'APPOINTMENT_ASSIGNED');
    assert.equal(assignDiff[0].isRead, false);
    assert.equal(assignDiff[0].readAt, null);

    // 2. RESCHEDULE -> +1 APPOINTMENT_RESCHEDULED
    const rescheduled = await api(`/me/client/appointments/${appointmentId}/reschedule`, {
      method: 'PATCH',
      headers: client.headers,
      body: { startAt: `${date}T11:00` },
    });
    assert.equal(rescheduled.status, 200);

    const afterReschedule = await getProInbox();
    assert.equal(afterReschedule.length, afterCreate.length + 1);
    const reschedDiff = afterReschedule.filter((n) => !afterCreate.some((b) => b.id === n.id));
    assert.equal(reschedDiff.length, 1);
    assert.equal(reschedDiff[0].appointmentId, appointmentId);
    assert.equal(reschedDiff[0].type, 'APPOINTMENT_RESCHEDULED');
    assert.equal(reschedDiff[0].isRead, false);
    assert.equal(reschedDiff[0].readAt, null);

    // 3. CANCEL -> +1 APPOINTMENT_CANCELLED
    const cancelled = await api(`/me/client/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      headers: client.headers,
    });
    assert.equal(cancelled.status, 200);

    const afterCancel = await getProInbox();
    assert.equal(afterCancel.length, afterReschedule.length + 1);
    const cancelDiff = afterCancel.filter((n) => !afterReschedule.some((b) => b.id === n.id));
    assert.equal(cancelDiff.length, 1);
    assert.equal(cancelDiff[0].appointmentId, appointmentId);
    assert.equal(cancelDiff[0].type, 'APPOINTMENT_CANCELLED');
    assert.equal(cancelDiff[0].isRead, false);
    assert.equal(cancelDiff[0].readAt, null);

    // Total exacto de 3 notificaciones para este Appointment
    const mine = afterCancel.filter((n) => n.appointmentId === appointmentId);
    assert.equal(mine.length, 3);
    assert.deepEqual(
      mine.map((n) => n.type).sort(),
      ['APPOINTMENT_ASSIGNED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED']
    );

    // Ausencia en el inbox de otro profesional
    const otherInbox = await api('/me/notifications', { headers: otherPro.headers });
    assert.equal(otherInbox.status, 200);
    assert.equal(
      otherInbox.data.notifications.filter((n) => n.appointmentId === appointmentId).length,
      0
    );

    // Verificación tenant-scoped en MongoDB del destinatario
    const dbDocs = await getMongoDb()
      .collection('notifications')
      .find({
        organizationId,
        recipientUserAccountId: pro.userAccountId,
        appointmentId,
      })
      .toArray();
    assert.equal(dbDocs.length, 3);
  });

  it('TC-HU13-02: profesional marca notificación como leída con readAt idéntico en repetición, persiste en historial y sin duplicado', async () => {
    const date = '2030-05-27'; // Monday (1)
    const pro = await createPro({
      name: 'Pro HU13-02',
      email: 'pro.hu1302@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
    });
    const client = await createClient({
      name: 'Cliente HU13-02',
      email: 'cli.hu1302@test.local',
    });

    const created = await api('/me/client/appointments', {
      method: 'POST',
      headers: client.headers,
      body: { professionalId: pro.id, serviceId: mainService.id, startAt: `${date}T09:00` },
    });
    assert.equal(created.status, 201);

    const unreadRes = await api('/me/notifications?status=unread', { headers: pro.headers });
    assert.equal(unreadRes.status, 200);
    const target = unreadRes.data.notifications.find((n) => n.appointmentId === created.data.id);
    assert.ok(target);
    assert.equal(target.isRead, false);
    assert.equal(target.readAt, null);

    const mark1 = await api(`/me/notifications/${target.id}`, {
      method: 'PATCH',
      headers: pro.headers,
      body: { isRead: true },
    });
    assert.equal(mark1.status, 200);
    assert.equal(mark1.data.id, target.id);
    assert.equal(mark1.data.isRead, true);
    assert.ok(typeof mark1.data.readAt === 'string' && mark1.data.readAt.length > 0);

    // Repetir PATCH { isRead: true } debe ser idempotente con readAt idéntico
    const mark2 = await api(`/me/notifications/${target.id}`, {
      method: 'PATCH',
      headers: pro.headers,
      body: { isRead: true },
    });
    assert.equal(mark2.status, 200);
    assert.equal(mark2.data.id, target.id);
    assert.equal(mark2.data.isRead, true);
    assert.equal(mark2.data.readAt, mark1.data.readAt);

    // Continúa en historial ?status=read sin duplicado
    const readList = await api('/me/notifications?status=read', { headers: pro.headers });
    assert.equal(readList.status, 200);
    const matchingRead = readList.data.notifications.filter((n) => n.id === target.id);
    assert.equal(matchingRead.length, 1);
    assert.equal(matchingRead[0].isRead, true);
    assert.equal(matchingRead[0].readAt, mark1.data.readAt);

    const dbCount = await getMongoDb()
      .collection('notifications')
      .countDocuments({
        organizationId,
        recipientUserAccountId: pro.userAccountId,
        appointmentId: created.data.id,
      });
    assert.equal(dbCount, 1);
  });

  it('TC-HU13-04: profesional sin eventos tiene inbox vacío (notifications: [], unreadCount: 0)', async () => {
    const freshPro = await createPro({
      name: 'Pro Sin Notif',
      email: 'pro.empty.hu1304@test.local',
      schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
    });

    const res = await api('/me/notifications', { headers: freshPro.headers });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.notifications, []);
    assert.equal(res.data.unreadCount, 0);
  });
});
