const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5001/api';

export const apiBase = DEFAULT_BASE_URL.replace(/\/+$/, '');

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${apiBase}/${String(path).replace(/^\/+/, '')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}
