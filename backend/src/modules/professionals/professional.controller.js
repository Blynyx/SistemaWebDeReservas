import {
  createProfessional,
  getProfessional,
  listProfessionals,
  patchProfessional,
  provisionProfessionalAccount,
  removeProfessional,
} from './professional.service.js';

export function createProfessionalController(req, res, next) {
  try {
    const result = createProfessional(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listProfessionalsController(req, res, next) {
  try {
    const professionals = listProfessionals(req.user.organizationId);
    res.status(200).json({ professionals });
  } catch (error) {
    next(error);
  }
}

export function getProfessionalController(req, res, next) {
  try {
    const result = getProfessional(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function patchProfessionalController(req, res, next) {
  try {
    const result = patchProfessional(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function deleteProfessionalController(req, res, next) {
  try {
    removeProfessional(req.user.organizationId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function provisionProfessionalAccountController(req, res, next) {
  try {
    const result = await provisionProfessionalAccount(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
