import {
  createReceptionist,
  listReceptionists,
  updateReceptionistStatus,
} from './receptionist.service.js';

export async function listReceptionistsController(req, res, next) {
  try {
    const receptionists = await listReceptionists(req.user.organizationId);
    res.status(200).json({ receptionists });
  } catch (error) {
    next(error);
  }
}

export async function createReceptionistController(req, res, next) {
  try {
    const receptionist = await createReceptionist(req.user.organizationId, req.body);
    res.status(201).json(receptionist);
  } catch (error) {
    next(error);
  }
}

export async function updateReceptionistStatusController(req, res, next) {
  try {
    const receptionist = await updateReceptionistStatus(
      req.user.organizationId,
      req.params.id,
      req.body
    );
    res.status(200).json(receptionist);
  } catch (error) {
    next(error);
  }
}
