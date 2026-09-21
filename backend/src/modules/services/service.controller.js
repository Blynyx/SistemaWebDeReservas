import {
  createService,
  getService,
  listServices,
  patchService,
  removeService,
} from './service.service.js';

export function createServiceController(req, res, next) {
  try {
    const result = createService(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listServicesController(req, res, next) {
  try {
    const services = listServices(req.user.organizationId);
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
}

export function getServiceController(req, res, next) {
  try {
    const result = getService(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function patchServiceController(req, res, next) {
  try {
    const result = patchService(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function deleteServiceController(req, res, next) {
  try {
    removeService(req.user.organizationId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
