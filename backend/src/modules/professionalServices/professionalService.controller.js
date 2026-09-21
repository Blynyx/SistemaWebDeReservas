import {
  assignServiceToProfessional,
  listAssignedServices,
  unassignServiceFromProfessional,
} from './professionalService.service.js';

export function assignServiceController(req, res, next) {
  try {
    const result = assignServiceToProfessional(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listAssignedServicesController(req, res, next) {
  try {
    const services = listAssignedServices(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
}

export function unassignServiceController(req, res, next) {
  try {
    unassignServiceFromProfessional(
      req.user.organizationId,
      req.params.professionalId,
      req.params.serviceId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
