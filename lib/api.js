const DEFAULT_BASE_URL = "https://attendance-back-end.onrender.com/api";
const REQUEST_TIMEOUT_MS = 12000;

const envPrimary = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
const envFallbacks = String(process.env.EXPO_PUBLIC_API_FALLBACK_URLS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

let activeApiBase = (envPrimary || DEFAULT_BASE_URL).replace(/\/+$/, "");

const apiCandidates = Array.from(
  new Set([activeApiBase, ...envFallbacks.map((x) => x.replace(/\/+$/, ""))])
);

export const apiBase = activeApiBase;

export function buildApiUrl(path, base = activeApiBase) {
  return `${base}/${String(path || "").replace(/^\/+/, "")}`;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
}

async function requestOnce(base, path, { method = "GET", body, token } = {}) {
  const timeout = withTimeout(REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(buildApiUrl(path, base), {
      method,
      signal: timeout.controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `System Error ${res.status}`);
    return data;
  } finally {
    timeout.clear();
  }
}

export async function apiFetch(path, options = {}) {
  let lastError = null;
  for (const base of apiCandidates) {
    try {
      const data = await requestOnce(base, path, options);
      activeApiBase = base;
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  const msg = String(lastError?.message || "");
  if (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("aborted")
  ) {
    throw new Error("Server connection failed. Check internet or set correct API URL in APK build.");
  }
  throw lastError || new Error("Request failed");
}
