import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  getAppointment,
  listAppointments,
  markNoShowAppointment,
  rescheduleAppointment,
} from './appointment.service.js';

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

export function confirmAppointmentController(req, res, next) {
  try {
    const result = confirmAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function cancelAppointmentController(req, res, next) {
  try {
    const result = cancelAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function rescheduleAppointmentController(req, res, next) {
  try {
    const result = rescheduleAppointment(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function completeAppointmentController(req, res, next) {
  try {
    const result = completeAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function markNoShowAppointmentController(req, res, next) {
  try {
    const result = markNoShowAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
