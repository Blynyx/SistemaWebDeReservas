import {
  createWeeklySchedule,
  listWeeklySchedules,
  patchWeeklySchedule,
  removeWeeklySchedule,
} from './weeklySchedule.service.js';

export function createWeeklyScheduleController(req, res, next) {
  try {
    const result = createWeeklySchedule(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listWeeklySchedulesController(req, res, next) {
  try {
    const schedules = listWeeklySchedules(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ schedules });
  } catch (error) {
    next(error);
  }
}

export function patchWeeklyScheduleController(req, res, next) {
  try {
    const result = patchWeeklySchedule(
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

export function deleteWeeklyScheduleController(req, res, next) {
  try {
    removeWeeklySchedule(
      req.user.organizationId,
      req.params.professionalId,
      req.params.scheduleId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
