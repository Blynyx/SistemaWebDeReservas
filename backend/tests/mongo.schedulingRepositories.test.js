import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  closeMongo,
  connectMongo,
  getMongoDb,
} from '../src/database/mongodb/client.js';
import { ensureIndexes } from '../src/database/mongodb/indexes.js';
import * as proRepo from '../src/database/mongodb/repositories/professional.repository.js';
import * as svcRepo from '../src/database/mongodb/repositories/service.repository.js';
import * as psRepo from '../src/database/mongodb/repositories/professionalService.repository.js';
import * as wsRepo from '../src/database/mongodb/repositories/weeklySchedule.repository.js';
import * as abRepo from '../src/database/mongodb/repositories/availabilityBlock.repository.js';
import * as aptRepo from '../src/database/mongodb/repositories/appointment.repository.js';
import * as notifRepo from '../src/database/mongodb/repositories/notification.repository.js';
import * as dashRepo from '../src/database/mongodb/repositories/dashboard.repository.js';
import * as cliRepo from '../src/database/mongodb/repositories/client.repository.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = process.env.MONGODB_TEST_DB_NAME || 'reservas_repo_26d_test';

let mongoAvailable = false;
let skipReason = '';

describe('MongoDB Scheduling, Appointments, Notifications & Dashboard Repositories (Etapa 26D)', () => {
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

  it('ProfessionalServices: insert, duplicate, find, list by service/professional, remove y tenant isolation', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const pro1 = randomUUID();
    const pro2 = randomUUID();
    const svc1 = randomUUID();
    const svc2 = randomUUID();

    await proRepo.insertProfessional({ id: pro1, organizationId: orgA, name: 'Dr. Zeta', email: null, phone: null });
    await proRepo.insertProfessional({ id: pro2, organizationId: orgA, name: 'Dra. Alfa', email: null, phone: null });
    await svcRepo.insertService({ id: svc1, organizationId: orgA, name: 'Terapia', description: null, durationMinutes: 45, priceMinorUnits: 4000 });
    await svcRepo.insertService({ id: svc2, organizationId: orgA, name: 'Consulta', description: null, durationMinutes: 30, priceMinorUnits: 3000 });

    await psRepo.insertAssignment({ organizationId: orgA, professionalId: pro1, serviceId: svc1 });
    await psRepo.insertAssignment({ organizationId: orgA, professionalId: pro2, serviceId: svc1 });
    await psRepo.insertAssignment({ organizationId: orgA, professionalId: pro1, serviceId: svc2 });

    assert.equal(await psRepo.assignmentExists(orgA, pro1, svc1), true);
    assert.equal(await psRepo.assignmentExists(orgB, pro1, svc1), false);

    const assignment = await psRepo.findAssignment(orgA, pro1, svc1);
    assert.equal(assignment.organization_id, orgA);
    assert.equal(assignment.professional_id, pro1);
    assert.equal(assignment.service_id, svc1);

    await assert.rejects(
      () => psRepo.insertAssignment({ organizationId: orgA, professionalId: pro1, serviceId: svc1 }),
      (err) => err.code === 11000
    );

    const pros = await psRepo.findProfessionalsByService(orgA, svc1);
    assert.deepEqual(pros.map((p) => p.name), ['Dr. Zeta', 'Dra. Alfa']);
    assert.equal(pros[0].is_active, 1);

    const svcs = await psRepo.findServicesByProfessional(orgA, pro1);
    assert.deepEqual(svcs.map((s) => s.name), ['Consulta', 'Terapia']);
    assert.equal(svcs[0].duration_minutes, 30);

    assert.deepEqual(await psRepo.findProfessionalsByService(orgB, svc1), []);

    await psRepo.removeAssignment(orgA, pro2, svc1);
    assert.equal(await psRepo.assignmentExists(orgA, pro2, svc1), false);
  });

  it('WeeklySchedules: CRUD, covering, overlap, adyacencia y tenant isolation', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const pro1 = randomUUID();
    const s1 = randomUUID();
    const s2 = randomUUID();

    await wsRepo.insertSchedule({
      id: s1,
      organizationId: orgA,
      professionalId: pro1,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
    });
    await wsRepo.insertSchedule({
      id: s2,
      organizationId: orgA,
      professionalId: pro1,
      dayOfWeek: 1,
      startTime: '12:00',
      endTime: '14:00',
    });

    const list = await wsRepo.findAllByProfessional(orgA, pro1);
    assert.equal(list.length, 2);
    assert.equal(list[0].start_time, '09:00');
    assert.equal(list[1].start_time, '12:00');

    const byDay = await wsRepo.findByProfessionalAndDay(orgA, pro1, 1);
    assert.equal(byDay.length, 2);

    const covering = await wsRepo.findCoveringSchedule(orgA, pro1, 1, '10:00', '11:00');
    assert.equal(covering.id, s1);

    // Overlap estricto vs adyacencia
    assert.equal(
      await wsRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, dayOfWeek: 1, startTime: '11:30', endTime: '12:00' }),
      true
    );
    assert.equal(
      await wsRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, dayOfWeek: 1, startTime: '14:00', endTime: '15:00' }),
      false
    );
    assert.equal(
      await wsRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, dayOfWeek: 1, startTime: '09:00', endTime: '12:00', excludeScheduleId: s1 }),
      false
    );

    await wsRepo.updateSchedule(orgA, pro1, s2, {
      dayOfWeek: 1,
      startTime: '13:00',
      endTime: '15:00',
      updatedAt: '2026-11-23T15:00:00.000Z',
    });
    assert.equal((await wsRepo.findById(orgA, pro1, s2)).start_time, '13:00');
    assert.equal(await wsRepo.findById(orgB, pro1, s2), null);

    await wsRepo.removeSchedule(orgA, pro1, s2);
    assert.equal(await wsRepo.findById(orgA, pro1, s2), null);
  });

  it('AvailabilityBlocks: CRUD, range, overlap, adyacencia, excludeBlockId y tenant isolation', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const pro1 = randomUUID();
    const b1 = randomUUID();

    await abRepo.insertBlock({
      id: b1,
      organizationId: orgA,
      professionalId: pro1,
      startAt: '2026-11-20T10:00',
      endAt: '2026-11-20T11:00',
      reason: 'Almuerzo',
    });

    const inRange = await abRepo.findByProfessionalInRange(orgA, pro1, '2026-11-20T09:00', '2026-11-20T12:00');
    assert.equal(inRange.length, 1);
    assert.equal(inRange[0].start_at, '2026-11-20T10:00');

    // Adyacencia permitida
    assert.equal(
      await abRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T11:00', endAt: '2026-11-20T12:00' }),
      false
    );
    // Overlap real
    assert.equal(
      await abRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T10:30', endAt: '2026-11-20T11:30' }),
      true
    );
    // Excluir propio bloque
    assert.equal(
      await abRepo.hasOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T10:00', endAt: '2026-11-20T11:00', excludeBlockId: b1 }),
      false
    );

    await abRepo.updateBlock(orgA, pro1, b1, {
      startAt: '2026-11-20T10:30',
      endAt: '2026-11-20T11:30',
      reason: 'Reunión',
      updatedAt: '2026-11-23T15:00:00.000Z',
    });
    assert.equal((await abRepo.findById(orgA, pro1, b1)).reason, 'Reunión');
    assert.equal(await abRepo.findById(orgB, pro1, b1), null);

    await abRepo.removeBlock(orgA, pro1, b1);
    assert.equal((await abRepo.findAllByProfessional(orgA, pro1)).length, 0);
  });

  it('Appointments: insert PROGRAMADA, filters, active overlap, adyacencia, reschedule con snapshots y tenant isolation', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const cli1 = randomUUID();
    const pro1 = randomUUID();
    const svc1 = randomUUID();
    const apt1 = randomUUID();
    const apt2 = randomUUID();

    await aptRepo.insertAppointment({
      id: apt1,
      organizationId: orgA,
      clientId: cli1,
      professionalId: pro1,
      serviceId: svc1,
      startAt: '2026-11-20T09:00',
      endAt: '2026-11-20T10:00',
      serviceDurationMinutes: 60,
      servicePriceMinorUnits: 5000,
    });
    await aptRepo.insertAppointment({
      id: apt2,
      organizationId: orgA,
      clientId: cli1,
      professionalId: pro1,
      serviceId: svc1,
      startAt: '2026-11-20T10:00',
      endAt: '2026-11-20T11:00',
      serviceDurationMinutes: 60,
      servicePriceMinorUnits: 5000,
    });

    const created = await aptRepo.findById(orgA, apt1);
    assert.equal(created.status, 'PROGRAMADA');
    assert.equal(created.service_duration_minutes, 60);
    assert.equal(created.service_price_minor_units, 5000);
    assert.equal(await aptRepo.findById(orgB, apt1), null);

    // Filtros
    const filtered = await aptRepo.findByFilters(orgA, {
      professionalId: pro1,
      status: 'PROGRAMADA',
      rangeStart: '2026-11-20T09:30',
      rangeEnd: '2026-11-20T10:30',
    });
    assert.equal(filtered.length, 2);

    // Overlap activo y adyacencia
    assert.equal(
      await aptRepo.hasActiveOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T11:00', endAt: '2026-11-20T12:00' }),
      false
    );
    assert.equal(
      await aptRepo.hasActiveOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T09:30', endAt: '2026-11-20T10:00' }),
      true
    );
    assert.equal(
      await aptRepo.hasActiveOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T09:00', endAt: '2026-11-20T10:00', excludeAppointmentId: apt1 }),
      false
    );

    // Cancelar apt1 libera disponibilidad
    await aptRepo.updateStatus(orgA, apt1, 'CANCELADA');
    assert.equal(
      await aptRepo.hasActiveOverlap({ organizationId: orgA, professionalId: pro1, startAt: '2026-11-20T09:00', endAt: '2026-11-20T10:00' }),
      false
    );

    // Reschedule de apt2 preserva snapshots y vuelve a PROGRAMADA
    await aptRepo.updateStatus(orgA, apt2, 'CONFIRMADA');
    await aptRepo.reschedule(orgA, apt2, { startAt: '2026-11-21T09:00', endAt: '2026-11-21T10:00' });
    const rescheduled = await aptRepo.findById(orgA, apt2);
    assert.equal(rescheduled.status, 'PROGRAMADA');
    assert.equal(rescheduled.start_at, '2026-11-21T09:00');
    assert.equal(rescheduled.service_duration_minutes, 60);
    assert.equal(rescheduled.service_price_minor_units, 5000);
  });

  it('Notifications y Dashboard: lectura/conteo, read state y métricas tenant-aware', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const userA = randomUUID();
    const n1 = randomUUID();
    const n2 = randomUUID();

    await notifRepo.insertNotification({
      id: n1,
      organizationId: orgA,
      recipientUserAccountId: userA,
      appointmentId: randomUUID(),
      type: 'APPOINTMENT_CREATED',
      title: 'Cita creada',
      message: 'Nueva cita',
    });
    await notifRepo.insertNotification({
      id: n2,
      organizationId: orgA,
      recipientUserAccountId: userA,
      appointmentId: randomUUID(),
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Cita confirmada',
      message: 'Confirmada',
    });

    assert.equal(await notifRepo.countUnread(orgA, userA), 2);
    assert.equal(await notifRepo.countUnread(orgB, userA), 0);

    await notifRepo.setReadState(orgA, userA, n1, true);
    const readOne = await notifRepo.findByRecipientAndId(orgA, userA, n1);
    assert.equal(readOne.is_read, 1);
    assert.ok(typeof readOne.read_at === 'string');

    assert.equal((await notifRepo.findByRecipient(orgA, userA, { unreadOnly: true })).length, 1);
    assert.equal((await notifRepo.findByRecipient(orgA, userA, { readOnly: true })).length, 1);

    await notifRepo.setReadState(orgA, userA, n1, false);
    const unreadAgain = await notifRepo.findByRecipientAndId(orgA, userA, n1);
    assert.equal(unreadAgain.is_read, 0);
    assert.equal(unreadAgain.read_at, null);

    // Dashboard
    await cliRepo.insertClient({ id: randomUUID(), organizationId: orgA, name: 'C1', email: null, phone: null });
    await proRepo.insertProfessional({ id: randomUUID(), organizationId: orgA, name: 'P1', email: null, phone: null });
    await svcRepo.insertService({ id: randomUUID(), organizationId: orgA, name: 'S1', description: null, durationMinutes: 30, priceMinorUnits: 1000 });
    await aptRepo.insertAppointment({
      id: randomUUID(),
      organizationId: orgA,
      clientId: randomUUID(),
      professionalId: randomUUID(),
      serviceId: randomUUID(),
      startAt: '2026-11-22T09:00',
      endAt: '2026-11-22T09:30',
      serviceDurationMinutes: 30,
      servicePriceMinorUnits: 1000,
    });

    const statusCounts = await dashRepo.countAppointmentsByStatusInRange(
      orgA,
      '2026-11-22T00:00',
      '2026-11-23T00:00'
    );
    assert.deepEqual(statusCounts, [{ status: 'PROGRAMADA', total: 1 }]);
    assert.equal(await dashRepo.countActiveClients(orgA), 1);
    assert.equal(await dashRepo.countActiveProfessionals(orgA), 1);
    assert.equal(await dashRepo.countActiveServices(orgA), 1);
    assert.equal(await dashRepo.countActiveClients(orgB), 0);
  });
});
