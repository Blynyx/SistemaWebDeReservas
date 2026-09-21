import {
  createAvailabilityBlock,
  listAvailabilityBlocks,
  patchAvailabilityBlock,
  removeAvailabilityBlock,
} from './availabilityBlock.service.js';

export function createAvailabilityBlockController(req, res, next) {
  try {
    const result = createAvailabilityBlock(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listAvailabilityBlocksController(req, res, next) {
  try {
    const blocks = listAvailabilityBlocks(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ blocks });
  } catch (error) {
    next(error);
  }
}

export function patchAvailabilityBlockController(req, res, next) {
  try {
    const result = patchAvailabilityBlock(
      req.user.organizationId,
      req.params.professionalId,
      req.params.blockId,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function deleteAvailabilityBlockController(req, res, next) {
  try {
    removeAvailabilityBlock(
      req.user.organizationId,
      req.params.professionalId,
      req.params.blockId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
