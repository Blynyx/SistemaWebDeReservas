import {
  assignServiceToProfessional,
  listAssignedServices,
  unassignServiceFromProfessional,
} from './professionalService.service.js';

export async function assignServiceController(req, res, next) {
  try {
    const result = await assignServiceToProfessional(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listAssignedServicesController(req, res, next) {
  try {
    const services = await listAssignedServices(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
}

export async function unassignServiceController(req, res, next) {
  try {
    await unassignServiceFromProfessional(
      req.user.organizationId,
      req.params.professionalId,
      req.params.serviceId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
