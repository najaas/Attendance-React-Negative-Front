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
