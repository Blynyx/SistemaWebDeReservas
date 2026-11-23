import {
  createProfessional,
  getProfessional,
  listProfessionals,
  patchProfessional,
  provisionProfessionalAccount,
  removeProfessional,
} from './professional.service.js';

export async function createProfessionalController(req, res, next) {
  try {
    const result = await createProfessional(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listProfessionalsController(req, res, next) {
  try {
    const professionals = await listProfessionals(req.user.organizationId);
    res.status(200).json({ professionals });
  } catch (error) {
    next(error);
  }
}

export async function getProfessionalController(req, res, next) {
  try {
    const result = await getProfessional(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function patchProfessionalController(req, res, next) {
  try {
    const result = await patchProfessional(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteProfessionalController(req, res, next) {
  try {
    await removeProfessional(req.user.organizationId, req.params.id);
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
