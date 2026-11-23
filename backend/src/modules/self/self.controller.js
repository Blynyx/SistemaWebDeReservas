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

export async function listMyProfessionalAppointmentsController(req, res, next) {
  try {
    const appointments = await listMyProfessionalAppointments(
      req.user.organizationId,
      req.domain.id,
      req.query
    );
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export async function createMyAppointmentController(req, res, next) {
  try {
    const result = await createMyAppointment(req.user.organizationId, req.domain.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelMyAppointmentController(req, res, next) {
  try {
    const result = await cancelMyAppointment(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rescheduleMyAppointmentController(req, res, next) {
  try {
    const result = await rescheduleMyAppointment(
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

export async function listMyClientAppointmentsController(req, res, next) {
  try {
    const appointments = await listMyClientAppointments(
      req.user.organizationId,
      req.domain.id,
      req.query
    );
    res.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

export async function completeMyAppointmentController(req, res, next) {
  try {
    const result = await completeMyAppointment(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function markMyAppointmentNoShowController(req, res, next) {
  try {
    const result = await markMyAppointmentNoShow(req.user.organizationId, req.domain.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createMyAvailabilityBlockController(req, res, next) {
  try {
    const result = await createMyAvailabilityBlock(req.user.organizationId, req.domain.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listMyAvailabilityBlocksController(req, res, next) {
  try {
    const blocks = await listMyAvailabilityBlocks(req.user.organizationId, req.domain.id);
    res.status(200).json({ blocks });
  } catch (error) {
    next(error);
  }
}

export async function patchMyAvailabilityBlockController(req, res, next) {
  try {
    const result = await patchMyAvailabilityBlock(
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

export async function deleteMyAvailabilityBlockController(req, res, next) {
  try {
    await removeMyAvailabilityBlock(req.user.organizationId, req.domain.id, req.params.blockId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
