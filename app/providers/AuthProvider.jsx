import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { apiFetch } from '../../lib/api';
import { clearToken, decodeJwt, loadToken, saveToken } from '../../lib/auth';
import { getExpoPushTokenSafe, setupNotificationHandler } from '../../lib/notifications';

const AuthContext = createContext(null);

function isTokenExpired(payload) {
  if (!payload) return true;
  if (!payload.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = async (expired = false) => {
    if (token) {
      const expoPushToken = await getExpoPushTokenSafe();
      if (expoPushToken) {
        apiFetch('/mobile/push-token', {
          method: 'DELETE',
          token,
          body: { expoPushToken }
        }).catch(() => {});
      }
    }
    await clearToken();
    setToken(null);
    setUser(null);
    if (expired) setSessionExpired(true);
  };

  useEffect(() => {
    // Setup notification handler safely (no-op in Expo Go)
    setupNotificationHandler();

    let mounted = true;
    let timer;

    loadToken()
      .then((savedToken) => {
        if (!mounted) return;
        if (savedToken) {
          const payload = decodeJwt(savedToken);
          if (!payload || isTokenExpired(payload)) {
            clearToken();
            return;
          }
          setToken(savedToken);
          setUser(payload);

          if (payload.exp) {
            const msUntilExpiry = payload.exp * 1000 - Date.now();
            timer = setTimeout(() => logout(true), msUntilExpiry);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const login = async (username, password) => {
    setSessionExpired(false);
    const data = await apiFetch('/login', { method: 'POST', body: { username, password } });
    if (data?.token) {
      const payload = decodeJwt(data.token);
      await saveToken(data.token);
      setToken(data.token);
      setUser(payload);
      registerDevicePushToken(data.token).catch(() => {});

      if (payload.exp) {
        const msUntilExpiry = payload.exp * 1000 - Date.now();
        setTimeout(() => logout(true), msUntilExpiry);
      }
    }
    return data;
  };

  useEffect(() => {
    if (!token) return;
    let active = true;

    (async () => {
      if (!active) return;
      registerDevicePushToken(token).catch(() => {});
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const registerDevicePushToken = async (authToken) => {
    if (!authToken) return;
    const expoPushToken = await getExpoPushTokenSafe();
    if (!expoPushToken) return;
    await apiFetch('/mobile/push-token', {
      method: 'POST',
      token: authToken,
      body: { expoPushToken, platform: Platform.OS }
    });
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, sessionExpired, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
