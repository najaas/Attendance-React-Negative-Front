import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'attendtrack_token';

// On web we skip SecureStore entirely (it lacks full support). Use SecureStore only on native.
const hasSecureStore =
  Platform.OS !== 'web' &&
  typeof SecureStore?.getItemAsync === 'function' &&
  typeof SecureStore?.setItemAsync === 'function' &&
  typeof SecureStore?.deleteItemAsync === 'function';

export async function saveToken(token) {
  if (hasSecureStore) return SecureStore.setItemAsync(TOKEN_KEY, token);
  if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export async function loadToken() {
  if (hasSecureStore) return SecureStore.getItemAsync(TOKEN_KEY);
  if (typeof localStorage !== 'undefined') return localStorage.getItem(TOKEN_KEY);
  return null;
}

export async function clearToken() {
  if (hasSecureStore) return SecureStore.deleteItemAsync(TOKEN_KEY);
  if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

function base64UrlToUtf8(input) {
  const base64 = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const normalized = pad ? base64 + '='.repeat(4 - pad) : base64;

  if (typeof atob === 'function') {
    const binary = atob(normalized);
    const bytes = Array.from(binary, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(bytes);
  }

  // atob may be unavailable on some React Native runtimes.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;
  let bc = 0;
  let bs;
  let buffer;
  while ((buffer = normalized.charAt(i++))) {
    const idx = chars.indexOf(buffer);
    if (idx < 0) continue;
    bs = bc % 4 ? (bs * 64) + idx : idx;
    if (bc++ % 4) {
      str += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }
  const utf8 = Array.from(str, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(utf8);
}

export function decodeJwt(token) {
  if (!token) return null;
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    return JSON.parse(base64UrlToUtf8(payload));
  } catch (_) {
    return null;
  }
}
