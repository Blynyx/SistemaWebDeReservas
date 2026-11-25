import { pathToFileURL } from 'node:url';
import { closeMongo, connectMongo, getMongoDb } from '../client.js';
import { ensureIndexes } from '../indexes.js';
import { findBySlug } from '../../../modules/organizations/organization.repository.js';
import { onboardOrganization } from '../../../modules/onboarding/onboarding.service.js';
import { createService } from '../../../modules/services/service.service.js';
import {
  createProfessional,
  provisionProfessionalAccount,
} from '../../../modules/professionals/professional.service.js';
import { assignServiceToProfessional } from '../../../modules/professionalServices/professionalService.service.js';
import { createWeeklySchedule } from '../../../modules/weeklySchedules/weeklySchedule.service.js';
import {
  createClient,
  provisionClientAccount,
} from '../../../modules/clients/client.service.js';
import { createReceptionist } from '../../../modules/receptionists/receptionist.service.js';
import { findByOrganizationIdAndEmail } from '../../../modules/userAccounts/userAccount.repository.js';

export const DEMO_SEED_CONFIG = {
  organizationName: 'Demo Reservas',
  organizationSlug: 'demo-reservas',
  adminEmail: 'admin@demo.local',
  adminPassword: 'Admin123!',
  receptionistEmail: 'recepcion@demo.local',
  receptionistPassword: 'Recepcion123!',
  serviceName: 'Consulta General',
  serviceDurationMinutes: 60,
  servicePriceMinorUnits: 5000,
  professionalName: 'Ana Torres',
  professionalEmail: 'profesional@demo.local',
  professionalPassword: 'Profesional123!',
  clientName: 'Cliente Demo',
  clientEmail: 'cliente@demo.local',
  clientPassword: 'Cliente123!',
};

export async function seedDemoData() {
  const existing = await findBySlug(DEMO_SEED_CONFIG.organizationSlug);
  if (existing) {
    const existingReceptionist = await findByOrganizationIdAndEmail(
      existing.id,
      DEMO_SEED_CONFIG.receptionistEmail
    );
    if (!existingReceptionist) {
      await createReceptionist(existing.id, {
        email: DEMO_SEED_CONFIG.receptionistEmail,
        password: DEMO_SEED_CONFIG.receptionistPassword,
      });
      return {
        skipped: false,
        database: getMongoDb().databaseName,
        organizationSlug: existing.slug,
        receptionistEmail: DEMO_SEED_CONFIG.receptionistEmail,
        receptionistPassword: DEMO_SEED_CONFIG.receptionistPassword,
        message: 'Cuenta RECEPTIONIST demo agregada a la organización existente.',
      };
    }

    return {
      skipped: true,
      database: getMongoDb().databaseName,
      organizationSlug: existing.slug,
      message: 'Datos demo ya existentes; no se duplicaron.',
    };
  }

  const { organization } = await onboardOrganization({
    organizationName: DEMO_SEED_CONFIG.organizationName,
    adminEmail: DEMO_SEED_CONFIG.adminEmail,
    adminPassword: DEMO_SEED_CONFIG.adminPassword,
  });

  const organizationId = organization.id;

  await createReceptionist(organizationId, {
    email: DEMO_SEED_CONFIG.receptionistEmail,
    password: DEMO_SEED_CONFIG.receptionistPassword,
  });

  const service = await createService(organizationId, {
    name: DEMO_SEED_CONFIG.serviceName,
    durationMinutes: DEMO_SEED_CONFIG.serviceDurationMinutes,
    priceMinorUnits: DEMO_SEED_CONFIG.servicePriceMinorUnits,
  });

  const professional = await createProfessional(organizationId, {
    name: DEMO_SEED_CONFIG.professionalName,
    email: DEMO_SEED_CONFIG.professionalEmail,
  });

  await provisionProfessionalAccount(organizationId, professional.id, {
    email: DEMO_SEED_CONFIG.professionalEmail,
    password: DEMO_SEED_CONFIG.professionalPassword,
  });

  await assignServiceToProfessional(organizationId, professional.id, {
    serviceId: service.id,
  });

  for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek += 1) {
    await createWeeklySchedule(organizationId, professional.id, {
      dayOfWeek,
      startTime: '09:00',
      endTime: '13:00',
    });
  }

  const client = await createClient(organizationId, {
    name: DEMO_SEED_CONFIG.clientName,
    email: DEMO_SEED_CONFIG.clientEmail,
  });

  await provisionClientAccount(organizationId, client.id, {
    email: DEMO_SEED_CONFIG.clientEmail,
    password: DEMO_SEED_CONFIG.clientPassword,
  });

  return {
    skipped: false,
    database: getMongoDb().databaseName,
    organizationSlug: organization.slug,
    adminEmail: DEMO_SEED_CONFIG.adminEmail,
    adminPassword: DEMO_SEED_CONFIG.adminPassword,
    receptionistEmail: DEMO_SEED_CONFIG.receptionistEmail,
    receptionistPassword: DEMO_SEED_CONFIG.receptionistPassword,
    professionalEmail: DEMO_SEED_CONFIG.professionalEmail,
    professionalPassword: DEMO_SEED_CONFIG.professionalPassword,
    clientEmail: DEMO_SEED_CONFIG.clientEmail,
    clientPassword: DEMO_SEED_CONFIG.clientPassword,
  };
}

const isCliEntrypoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliEntrypoint) {
  try {
    await connectMongo();
    await ensureIndexes();
    const result = await seedDemoData();

    if (result.skipped) {
      console.log(result.message, {
        database: result.database,
        organizationSlug: result.organizationSlug,
      });
    } else {
      console.log('Seed demo creado correctamente:', result);
    }
  } catch (error) {
    console.error('Error al ejecutar seed demo MongoDB:', error.message);
    process.exitCode = 1;
  } finally {
    await closeMongo();
  }
}
