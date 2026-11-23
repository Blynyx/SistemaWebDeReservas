import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  closeMongo,
  connectMongo,
  getMongoDb,
} from '../src/database/mongodb/client.js';
import { ensureIndexes } from '../src/database/mongodb/indexes.js';
import {
  isProfessionalDayLockDuplicateKeyError,
  PROFESSIONAL_DAY_LOCK_INDEX_NAME,
} from '../src/database/mongodb/errors.js';
import {
  withDayLockTransaction,
  withTransaction,
} from '../src/database/mongodb/transaction.js';
import {
  acquireProfessionalDayLock,
  extractLockDate,
} from '../src/database/mongodb/repositories/professionalDayLock.repository.js';
import * as proRepo from '../src/database/mongodb/repositories/professional.repository.js';
import * as cliRepo from '../src/database/mongodb/repositories/client.repository.js';
import * as svcRepo from '../src/database/mongodb/repositories/service.repository.js';
import * as psRepo from '../src/database/mongodb/repositories/professionalService.repository.js';
import * as wsRepo from '../src/database/mongodb/repositories/weeklySchedule.repository.js';
import * as abRepo from '../src/database/mongodb/repositories/availabilityBlock.repository.js';
import * as aptRepo from '../src/database/mongodb/repositories/appointment.repository.js';
import * as notifRepo from '../src/database/mongodb/repositories/notification.repository.js';

const TEST_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const TEST_DB_NAME = process.env.MONGODB_TEST_DB_NAME || 'reservas_conc_26d_test';

let mongoAvailable = false;
let skipReason = '';

class BusinessConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessConflictError';
  }
}

async function bookAppointmentIsolated({
  organizationId,
  clientId,
  professionalId,
  serviceId,
  dayOfWeek,
  startAt,
  endAt,
  startTime,
  endTime,
  recipientUserAccountId,
}) {
  // IDs generados fuera de la callback para garantizar estabilidad ante reintentos
  const appointmentId = randomUUID();
  const notificationId = randomUUID();
  const lockDate = extractLockDate(startAt);

  return withDayLockTransaction(async (session) => {
    await acquireProfessionalDayLock(
      { organizationId, professionalId, date: lockDate },
      { session }
    );

    const professional = await proRepo.findById(organizationId, professionalId, { session });
    if (!professional || professional.is_active !== 1) {
      throw new BusinessConflictError('Profesional no disponible');
    }

    const client = await cliRepo.findById(organizationId, clientId, { session });
    if (!client || client.is_active !== 1) {
      throw new BusinessConflictError('Cliente no disponible');
    }

    const service = await svcRepo.findById(organizationId, serviceId, { session });
    if (!service || service.is_active !== 1) {
      throw new BusinessConflictError('Servicio no disponible');
    }

    const assigned = await psRepo.assignmentExists(organizationId, professionalId, serviceId, {
      session,
    });
    if (!assigned) {
      throw new BusinessConflictError('Profesional no habilitado para el servicio');
    }

    const covering = await wsRepo.findCoveringSchedule(
      organizationId,
      professionalId,
      dayOfWeek,
      startTime,
      endTime,
      { session }
    );
    if (!covering) {
      throw new BusinessConflictError('Fuera de horario semanal');
    }

    const blocked = await abRepo.hasOverlap(
      { organizationId, professionalId, startAt, endAt },
      { session }
    );
    if (blocked) {
      throw new BusinessConflictError('Bloque de indisponibilidad');
    }

    const overlapping = await aptRepo.hasActiveOverlap(
      { organizationId, professionalId, startAt, endAt },
      { session }
    );
    if (overlapping) {
      throw new BusinessConflictError('El profesional ya tiene una cita en ese horario');
    }

    await aptRepo.insertAppointment(
      {
        id: appointmentId,
        organizationId,
        clientId,
        professionalId,
        serviceId,
        startAt,
        endAt,
        serviceDurationMinutes: service.duration_minutes,
        servicePriceMinorUnits: service.price_minor_units,
      },
      { session }
    );

    await notifRepo.insertNotification(
      {
        id: notificationId,
        organizationId,
        recipientUserAccountId,
        appointmentId,
        type: 'APPOINTMENT_CREATED',
        title: 'Cita creada',
        message: `Cita ${startAt}`,
      },
      { session }
    );

    return { outcome: 'SUCCESS', appointmentId };
  });
}

describe('MongoDB Concurrency, Locks & Transaction Atomicity (Etapa 26D)', () => {
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

  it('professionalDayLocks: valida session obligatoria, seq, aislamiento y commit/rollback', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgA = randomUUID();
    const orgB = randomUUID();
    const pro1 = randomUUID();
    const pro2 = randomUUID();

    // 1. Acquire sin session falla explícitamente
    await assert.rejects(
      () => acquireProfessionalDayLock({ organizationId: orgA, professionalId: pro1, date: '2026-11-20' }),
      /ClientSession es obligatoria/
    );

    // 2. Primera adquisición crea lock con seq = 1
    const first = await withTransaction((session) =>
      acquireProfessionalDayLock({ organizationId: orgA, professionalId: pro1, date: '2026-11-20' }, { session })
    );
    assert.equal(first.seq, 1);

    // 3. Segunda adquisición incrementa seq = 2
    const second = await withTransaction((session) =>
      acquireProfessionalDayLock({ organizationId: orgA, professionalId: pro1, date: '2026-11-20' }, { session })
    );
    assert.equal(second.seq, 2);

    // 4, 5, 6. Organización, profesional o fecha distinta no comparten lock
    const diffOrg = await withTransaction((session) =>
      acquireProfessionalDayLock({ organizationId: orgB, professionalId: pro1, date: '2026-11-20' }, { session })
    );
    const diffPro = await withTransaction((session) =>
      acquireProfessionalDayLock({ organizationId: orgA, professionalId: pro2, date: '2026-11-20' }, { session })
    );
    const diffDate = await withTransaction((session) =>
      acquireProfessionalDayLock({ organizationId: orgA, professionalId: pro1, date: '2026-11-21' }, { session })
    );
    assert.equal(diffOrg.seq, 1);
    assert.equal(diffPro.seq, 1);
    assert.equal(diffDate.seq, 1);

    // 7. Rollback revierte la modificación del lock
    await assert.rejects(
      () =>
        withTransaction(async (session) => {
          await acquireProfessionalDayLock(
            { organizationId: orgA, professionalId: pro1, date: '2026-11-20' },
            { session }
          );
          throw new Error('rollback lock');
        }),
      /rollback lock/
    );

    const lockDoc = await getMongoDb()
      .collection('professionalDayLocks')
      .findOne({ organizationId: orgA, professionalId: pro1, date: '2026-11-20' });
    assert.equal(lockDoc.seq, 2);
  });

  it('CONC-MONGO-01: dos reservas simultáneas para el mismo intervalo -> 1 SUCCESS, 1 BUSINESS_CONFLICT y 1 cita activa', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgId = randomUUID();
    const proId = randomUUID();
    const svcId = randomUUID();
    const cliId = randomUUID();
    const recipientId = randomUUID();

    await proRepo.insertProfessional({ id: proId, organizationId: orgId, name: 'Dr. Conc', email: null, phone: null });
    await cliRepo.insertClient({ id: cliId, organizationId: orgId, name: 'Cliente Conc', email: null, phone: null });
    await svcRepo.insertService({ id: svcId, organizationId: orgId, name: 'Consulta', description: null, durationMinutes: 60, priceMinorUnits: 5000 });
    await psRepo.insertAssignment({ organizationId: orgId, professionalId: proId, serviceId: svcId });
    await wsRepo.insertSchedule({ id: randomUUID(), organizationId: orgId, professionalId: proId, dayOfWeek: 5, startTime: '09:00', endTime: '12:00' });

    const attempt = () =>
      bookAppointmentIsolated({
        organizationId: orgId,
        clientId: cliId,
        professionalId: proId,
        serviceId: svcId,
        dayOfWeek: 5,
        startAt: '2026-11-20T09:00',
        endAt: '2026-11-20T10:00',
        startTime: '09:00',
        endTime: '10:00',
        recipientUserAccountId: recipientId,
      }).catch((err) => {
        if (err instanceof BusinessConflictError) {
          return { outcome: 'BUSINESS_CONFLICT', message: err.message };
        }
        throw err;
      });

    const results = await Promise.all([attempt(), attempt()]);
    const successes = results.filter((r) => r.outcome === 'SUCCESS');
    const conflicts = results.filter((r) => r.outcome === 'BUSINESS_CONFLICT');

    assert.equal(successes.length, 1);
    assert.equal(conflicts.length, 1);

    const active = await aptRepo.findActiveByProfessionalInRange(
      orgId,
      proId,
      '2026-11-20T09:00',
      '2026-11-20T10:00'
    );
    assert.equal(active.length, 1);
    assert.equal(active[0].status, 'PROGRAMADA');
  });

  it('CONC-MONGO-02: citas adyacentes 09:00-10:00 y 10:00-11:00 completan ambas con PROGRAMADA', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgId = randomUUID();
    const proId = randomUUID();
    const svcId = randomUUID();
    const cliId = randomUUID();
    const recipientId = randomUUID();

    await proRepo.insertProfessional({ id: proId, organizationId: orgId, name: 'Dr. Adj', email: null, phone: null });
    await cliRepo.insertClient({ id: cliId, organizationId: orgId, name: 'Cliente Adj', email: null, phone: null });
    await svcRepo.insertService({ id: svcId, organizationId: orgId, name: 'Consulta', description: null, durationMinutes: 60, priceMinorUnits: 5000 });
    await psRepo.insertAssignment({ organizationId: orgId, professionalId: proId, serviceId: svcId });
    await wsRepo.insertSchedule({ id: randomUUID(), organizationId: orgId, professionalId: proId, dayOfWeek: 5, startTime: '09:00', endTime: '12:00' });

    const r1 = await bookAppointmentIsolated({
      organizationId: orgId,
      clientId: cliId,
      professionalId: proId,
      serviceId: svcId,
      dayOfWeek: 5,
      startAt: '2026-11-20T09:00',
      endAt: '2026-11-20T10:00',
      startTime: '09:00',
      endTime: '10:00',
      recipientUserAccountId: recipientId,
    });
    const r2 = await bookAppointmentIsolated({
      organizationId: orgId,
      clientId: cliId,
      professionalId: proId,
      serviceId: svcId,
      dayOfWeek: 5,
      startAt: '2026-11-20T10:00',
      endAt: '2026-11-20T11:00',
      startTime: '10:00',
      endTime: '11:00',
      recipientUserAccountId: recipientId,
    });

    assert.equal(r1.outcome, 'SUCCESS');
    assert.equal(r2.outcome, 'SUCCESS');

    const active = await aptRepo.findActiveByProfessionalInRange(
      orgId,
      proId,
      '2026-11-20T09:00',
      '2026-11-20T12:00'
    );
    assert.equal(active.length, 2);
    assert.ok(active.every((a) => a.status === 'PROGRAMADA'));
  });

  it('E11000 del lock: clasifica solo índice del lock y ejecuta retry acotado; otros E11000 no se reintentan', async () => {
    const lockErr = Object.assign(
      new Error(`E11000 duplicate key error collection: reservas.professionalDayLocks index: ${PROFESSIONAL_DAY_LOCK_INDEX_NAME}`),
      { code: 11000 }
    );
    const emailErr = Object.assign(
      new Error('E11000 duplicate key error collection: reservas.userAccounts index: ux_user_accounts_org_email'),
      { code: 11000 }
    );

    assert.equal(isProfessionalDayLockDuplicateKeyError(lockErr), true);
    assert.equal(isProfessionalDayLockDuplicateKeyError(emailErr), false);

    const fakeClient = {
      startSession() {
        return {
          async withTransaction(fn) {
            return fn();
          },
          async endSession() {},
        };
      },
    };

    // Caso 1: E11000 del lock se reintenta hasta tener éxito en el intento 3
    let lockAttempts = 0;
    const okResult = await withDayLockTransaction(
      async () => {
        lockAttempts += 1;
        if (lockAttempts < 3) {
          throw lockErr;
        }
        return 'ok';
      },
      { client: fakeClient, maxAttempts: 5 }
    );
    assert.equal(okResult, 'ok');
    assert.equal(lockAttempts, 3);

    // Caso 2: E11000 del lock agotado tras maxAttempts=5 lanza el error
    let exhaustedAttempts = 0;
    await assert.rejects(
      () =>
        withDayLockTransaction(
          async () => {
            exhaustedAttempts += 1;
            throw lockErr;
          },
          { client: fakeClient, maxAttempts: 5 }
        ),
      (err) => err === lockErr
    );
    assert.equal(exhaustedAttempts, 5);

    // Caso 3: Otro E11000 (email duplicado) NO se reintenta (1 solo intento)
    let emailAttempts = 0;
    await assert.rejects(
      () =>
        withDayLockTransaction(
          async () => {
            emailAttempts += 1;
            throw emailErr;
          },
          { client: fakeClient, maxAttempts: 5 }
        ),
      (err) => err === emailErr
    );
    assert.equal(emailAttempts, 1);
  });

  it('Atomicidad Appointment + Notification + lock: rollback completo ante fallo y commit conjunto sin error', async (t) => {
    if (!mongoAvailable) return t.skip(skipReason);

    const orgId = randomUUID();
    const proId = randomUUID();
    const recipientId = randomUUID();
    const aptFailId = randomUUID();
    const notifFailId = randomUUID();

    // Transacción fallida: Appointment, Notification y lock NO deben persistir
    await assert.rejects(
      () =>
        withTransaction(async (session) => {
          await acquireProfessionalDayLock(
            { organizationId: orgId, professionalId: proId, date: '2026-11-25' },
            { session }
          );
          await aptRepo.insertAppointment(
            {
              id: aptFailId,
              organizationId: orgId,
              clientId: randomUUID(),
              professionalId: proId,
              serviceId: randomUUID(),
              startAt: '2026-11-25T09:00',
              endAt: '2026-11-25T10:00',
              serviceDurationMinutes: 60,
              servicePriceMinorUnits: 5000,
            },
            { session }
          );
          await notifRepo.insertNotification(
            {
              id: notifFailId,
              organizationId: orgId,
              recipientUserAccountId: recipientId,
              appointmentId: aptFailId,
              type: 'APPOINTMENT_CREATED',
              title: 'Cita',
              message: 'Msg',
            },
            { session }
          );
          throw new Error('fallo antes de commit');
        }),
      /fallo antes de commit/
    );

    assert.equal(await aptRepo.findById(orgId, aptFailId), null);
    assert.equal(await notifRepo.findByRecipientAndId(orgId, recipientId, notifFailId), null);
    assert.equal(
      await getMongoDb()
        .collection('professionalDayLocks')
        .findOne({ organizationId: orgId, professionalId: proId, date: '2026-11-25' }),
      null
    );

    // Misma operación sin error: los 3 persisten atómicamente
    const aptOkId = randomUUID();
    const notifOkId = randomUUID();
    await withTransaction(async (session) => {
      await acquireProfessionalDayLock(
        { organizationId: orgId, professionalId: proId, date: '2026-11-25' },
        { session }
      );
      await aptRepo.insertAppointment(
        {
          id: aptOkId,
          organizationId: orgId,
          clientId: randomUUID(),
          professionalId: proId,
          serviceId: randomUUID(),
          startAt: '2026-11-25T09:00',
          endAt: '2026-11-25T10:00',
          serviceDurationMinutes: 60,
          servicePriceMinorUnits: 5000,
        },
        { session }
      );
      await notifRepo.insertNotification(
        {
          id: notifOkId,
          organizationId: orgId,
          recipientUserAccountId: recipientId,
          appointmentId: aptOkId,
          type: 'APPOINTMENT_CREATED',
          title: 'Cita',
          message: 'Msg',
        },
        { session }
      );
    });

    assert.equal((await aptRepo.findById(orgId, aptOkId)).status, 'PROGRAMADA');
    assert.equal((await notifRepo.findByRecipientAndId(orgId, recipientId, notifOkId)).is_read, 0);
    const lockAfter = await getMongoDb()
      .collection('professionalDayLocks')
      .findOne({ organizationId: orgId, professionalId: proId, date: '2026-11-25' });
    assert.equal(lockAfter.seq, 1);
  });
});
