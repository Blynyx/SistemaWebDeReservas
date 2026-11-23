import {
  createWeeklySchedule,
  listWeeklySchedules,
  patchWeeklySchedule,
  removeWeeklySchedule,
} from './weeklySchedule.service.js';

export async function createWeeklyScheduleController(req, res, next) {
  try {
    const result = await createWeeklySchedule(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listWeeklySchedulesController(req, res, next) {
  try {
    const schedules = await listWeeklySchedules(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ schedules });
  } catch (error) {
    next(error);
  }
}

export async function patchWeeklyScheduleController(req, res, next) {
  try {
    const result = await patchWeeklySchedule(
      req.user.organizationId,
      req.params.professionalId,
      req.params.scheduleId,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteWeeklyScheduleController(req, res, next) {
  try {
    await removeWeeklySchedule(
      req.user.organizationId,
      req.params.professionalId,
      req.params.scheduleId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
