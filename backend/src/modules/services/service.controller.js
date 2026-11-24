import {
  createService,
  getService,
  listServices,
  patchService,
  removeService,
} from './service.service.js';

export async function createServiceController(req, res, next) {
  try {
    const result = await createService(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listServicesController(req, res, next) {
  try {
    const services = await listServices(req.user.organizationId, {
      activeOnly: req.user.role === 'CLIENT',
    });
    res.status(200).json({ services });
  } catch (error) {
    next(error);
  }
}

export async function getServiceController(req, res, next) {
  try {
    const result = await getService(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function patchServiceController(req, res, next) {
  try {
    const result = await patchService(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteServiceController(req, res, next) {
  try {
    await removeService(req.user.organizationId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
