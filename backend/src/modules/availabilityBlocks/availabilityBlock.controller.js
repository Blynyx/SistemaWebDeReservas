import {
  createAvailabilityBlock,
  listAvailabilityBlocks,
  patchAvailabilityBlock,
  removeAvailabilityBlock,
} from './availabilityBlock.service.js';

export async function createAvailabilityBlockController(req, res, next) {
  try {
    const result = await createAvailabilityBlock(
      req.user.organizationId,
      req.params.professionalId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listAvailabilityBlocksController(req, res, next) {
  try {
    const blocks = await listAvailabilityBlocks(req.user.organizationId, req.params.professionalId);
    res.status(200).json({ blocks });
  } catch (error) {
    next(error);
  }
}

export async function patchAvailabilityBlockController(req, res, next) {
  try {
    const result = await patchAvailabilityBlock(
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

export async function deleteAvailabilityBlockController(req, res, next) {
  try {
    await removeAvailabilityBlock(
      req.user.organizationId,
      req.params.professionalId,
      req.params.blockId
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
