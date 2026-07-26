import { getPlayerId } from './identity';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export async function apiFetch(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-Id': getPlayerId(),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.code || 'REQUEST_FAILED', data?.message || `Request to ${path} failed`);
  }
  return data;
}
