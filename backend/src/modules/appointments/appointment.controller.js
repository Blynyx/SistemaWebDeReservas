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

export async function createAppointmentController(req, res, next) {
  try {
    const result = await createAppointment(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listAppointmentsController(req, res, next) {
  try {
    const appointments = await listAppointments(req.user.organizationId, req.query);
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentController(req, res, next) {
  try {
    const result = await getAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function confirmAppointmentController(req, res, next) {
  try {
    const result = await confirmAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelAppointmentController(req, res, next) {
  try {
    const result = await cancelAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rescheduleAppointmentController(req, res, next) {
  try {
    const result = await rescheduleAppointment(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeAppointmentController(req, res, next) {
  try {
    const result = await completeAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function markNoShowAppointmentController(req, res, next) {
  try {
    const result = await markNoShowAppointment(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
