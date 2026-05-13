import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { apiFetch } from '../../lib/api';
import { clearToken, decodeJwt, loadToken, saveToken } from '../../lib/auth';
import { getExpoPushTokenSafe } from '../../lib/notifications';

const AuthContext = createContext(null);

function isTokenExpired(payload) {
  if (!payload || !payload.exp) return false; // Never expire if no 'exp' claim
  const expMs = payload.exp > 1e12 ? payload.exp : payload.exp * 1000;
  return Date.now() >= expMs;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiryTimerRef = useRef(null);
  const pushRegisteredRef = useRef(false);

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
    pushRegisteredRef.current = false;
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
        registerDevicePushTokenWithRetry(data.token).catch(() => {});
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
      registerDevicePushTokenWithRetry(token).catch(() => {});
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const registerDevicePushToken = async (authToken) => {
    if (pushRegisteredRef.current) return true;
    if (!authToken) return;
    const expoPushToken = await getExpoPushTokenSafe();
    if (!expoPushToken) return false;
    await apiFetch('/mobile/push-token', {
      method: 'POST',
      token: authToken,
      body: { expoPushToken, platform: Platform.OS }
    });
    pushRegisteredRef.current = true;
    return true;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const registerDevicePushTokenWithRetry = async (authToken) => {
    const delays = [0, 3000, 8000];
    for (const delay of delays) {
      if (delay > 0) await sleep(delay);
      try {
        const ok = await registerDevicePushToken(authToken);
        if (ok) return true;
      } catch {
        // retry next round
      }
    }
    return false;
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
