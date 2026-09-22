import {
  createClient,
  getClient,
  listClients,
  patchClient,
  provisionClientAccount,
  removeClient,
} from './client.service.js';

export function createClientController(req, res, next) {
  try {
    const result = createClient(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export function listClientsController(req, res, next) {
  try {
    const clients = listClients(req.user.organizationId);
    res.status(200).json({ clients });
  } catch (error) {
    next(error);
  }
}

export function getClientController(req, res, next) {
  try {
    const result = getClient(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function patchClientController(req, res, next) {
  try {
    const result = patchClient(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export function deleteClientController(req, res, next) {
  try {
    removeClient(req.user.organizationId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function provisionClientAccountController(req, res, next) {
  try {
    const result = await provisionClientAccount(
      req.user.organizationId,
      req.params.clientId,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
