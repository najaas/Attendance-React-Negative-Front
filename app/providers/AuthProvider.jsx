import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { apiFetch } from '../../lib/api';
import { clearToken, decodeJwt, loadToken, saveToken } from '../../lib/auth';
import { getExpoPushTokenSafe } from '../../lib/notifications';

const AuthContext = createContext(null);

function isTokenExpired(payload) {
  if (!payload || !payload.exp) return true;
  const expMs = payload.exp > 1e12 ? payload.exp : payload.exp * 1000;
  return Date.now() >= expMs;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiryTimerRef = useRef(null);

  const clearExpiryTimer = () => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  const armExpiryTimer = (payload) => {
    clearExpiryTimer();
    if (!payload || !payload.exp) return;
    const expMs = payload.exp > 1e12 ? payload.exp : payload.exp * 1000;
    const msUntilExpiry = expMs - Date.now();
    if (msUntilExpiry <= 0) return;
    expiryTimerRef.current = setTimeout(() => logout(true), msUntilExpiry);
  };

  const logout = async (expired = false) => {
    clearExpiryTimer();
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
    let mounted = true;

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
          armExpiryTimer(payload);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      clearExpiryTimer();
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
      // NON-BLOCKING: Move registration to background so UI transition is instant
      setTimeout(() => {
        registerDevicePushToken(data.token).catch(() => {});
      }, 0);

      armExpiryTimer(payload);
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
