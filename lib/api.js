const DEFAULT_BASE_URL = "https://attendance-back-end.onrender.com/api";

export const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

export function buildApiUrl(path) {
  return `${apiBase}/${String(path || "").replace(/^\/+/, "")}`;
}

export async function apiFetch(path, { method = "GET", body, token } = {}) {
  try {
    const res = await fetch(buildApiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `System Error ${res.status}`);
    return data;
  } catch (err) {
    if (err.message.includes('Network request failed') || err.message.includes('Failed to fetch')) {
      throw new Error("Cannot reach server. Try using your computer's IP address instead of localhost.");
    }
    throw err;
  }
}
