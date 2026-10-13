import { apiRequest } from './apiClient.js';

export function listAvailabilityBlocks(professionalId) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/availability-blocks`);
}

export function createAvailabilityBlock(professionalId, data) {
  return apiRequest(`/professionals/${encodeURIComponent(professionalId)}/availability-blocks`, {
    method: 'POST',
    body: data,
  });
}

export function updateAvailabilityBlock(professionalId, blockId, data) {
  return apiRequest(
    `/professionals/${encodeURIComponent(professionalId)}/availability-blocks/${encodeURIComponent(blockId)}`,
    {
      method: 'PATCH',
      body: data,
    }
  );
}

export function deleteAvailabilityBlock(professionalId, blockId) {
  return apiRequest(
    `/professionals/${encodeURIComponent(professionalId)}/availability-blocks/${encodeURIComponent(blockId)}`,
    { method: 'DELETE' }
  );
}
