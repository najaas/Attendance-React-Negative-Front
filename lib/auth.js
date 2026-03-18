import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'attendtrack_token';

export async function saveToken(token) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function decodeJwt(token) {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const str = atob(pad ? base64 + '='.repeat(4 - pad) : base64);
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}
