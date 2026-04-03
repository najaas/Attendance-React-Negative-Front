import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { apiFetch } from '../../lib/api';
import { clearToken, decodeJwt, loadToken, saveToken } from '../../lib/auth';
import { getExpoPushTokenSafe } from '../../lib/notifications';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    loadToken()
      .then((savedToken) => {
        if (!mounted) return;
        if (savedToken) {
          setToken(savedToken);
          setUser(decodeJwt(savedToken));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (username, password) => {
    const data = await apiFetch('/login', { method: 'POST', body: { username, password } });
    if (data?.token) {
      await saveToken(data.token);
      setToken(data.token);
      setUser(decodeJwt(data.token));
      registerDevicePushToken(data.token).catch(() => {});
    }
    return data;
  };

  const logout = async () => {
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
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
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
