import {
  createClient,
  getClient,
  listClients,
  patchClient,
  provisionClientAccount,
  removeClient,
} from './client.service.js';

export async function createClientController(req, res, next) {
  try {
    const result = await createClient(req.user.organizationId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listClientsController(req, res, next) {
  try {
    const clients = await listClients(req.user.organizationId);
    res.status(200).json({ clients });
  } catch (error) {
    next(error);
  }
}

export async function getClientController(req, res, next) {
  try {
    const result = await getClient(req.user.organizationId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function patchClientController(req, res, next) {
  try {
    const result = await patchClient(req.user.organizationId, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteClientController(req, res, next) {
  try {
    await removeClient(req.user.organizationId, req.params.id);
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
