import { createAppointment, getAppointment, listAppointments } from './appointment.service.js';

export function createAppointmentController(req, res, next) {
  try {
    const result = createAppointment(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listAppointmentsController(req, res, next) {
  try {
    const appointments = listAppointments(req.user.organizationId);
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export function getAppointmentController(req, res, next) {
  try {
    const result = getAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
