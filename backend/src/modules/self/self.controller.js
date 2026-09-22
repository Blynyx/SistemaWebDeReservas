import {
  cancelMyAppointment,
  completeMyAppointment,
  createMyAppointment,
  createMyAvailabilityBlock,
  getMyClient,
  getMyProfessional,
  listMyAvailabilityBlocks,
  listMyClientAppointments,
  listMyProfessionalAppointments,
  markMyAppointmentNoShow,
  patchMyAvailabilityBlock,
  removeMyAvailabilityBlock,
  rescheduleMyAppointment,
} from './self.service.js';

export function getMyProfessionalController(req, res, next) {
  try {
    res.status(200).json(getMyProfessional(req.domain.professional));
  } catch (error) {
    next(error);
  }
}

export function getMyClientController(req, res, next) {
  try {
    res.status(200).json(getMyClient(req.domain.client));
  } catch (error) {
    next(error);
  }
}

export function listMyProfessionalAppointmentsController(req, res, next) {
  try {
    const appointments = listMyProfessionalAppointments(
      req.user.organizationId,
      req.domain.id,
      req.query
    );
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export function createMyAppointmentController(req, res, next) {
  try {
    const result = createMyAppointment(req.user.organizationId, req.domain.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function cancelMyAppointmentController(req, res, next) {
  try {
    const result = cancelMyAppointment(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function rescheduleMyAppointmentController(req, res, next) {
  try {
    const result = rescheduleMyAppointment(
      req.user.organizationId,
      req.domain.id,
      req.params.id,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function listMyClientAppointmentsController(req, res, next) {
  try {
    const appointments = listMyClientAppointments(
      req.user.organizationId,
      req.domain.id,
      req.query
    );
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export function completeMyAppointmentController(req, res, next) {
  try {
    const result = completeMyAppointment(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function markMyAppointmentNoShowController(req, res, next) {
  try {
    const result = markMyAppointmentNoShow(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function createMyAvailabilityBlockController(req, res, next) {
  try {
    const result = createMyAvailabilityBlock(req.user.organizationId, req.domain.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listMyAvailabilityBlocksController(req, res, next) {
  try {
    const blocks = listMyAvailabilityBlocks(req.user.organizationId, req.domain.id);
    res.status(200).json({ blocks });
  } catch (error) {
    next(error);
  }
}

export function patchMyAvailabilityBlockController(req, res, next) {
  try {
    const result = patchMyAvailabilityBlock(
      req.user.organizationId,
      req.domain.id,
      req.params.blockId,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function deleteMyAvailabilityBlockController(req, res, next) {
  try {
    removeMyAvailabilityBlock(req.user.organizationId, req.domain.id, req.params.blockId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
