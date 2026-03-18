import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadToken, saveToken, clearToken, decodeJwt } from '../../lib/auth';
import { apiFetch } from '../../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken().then((t) => {
      if (t) {
        setToken(t);
        setUser(decodeJwt(t));
      }
      setLoading(false);
    });
  }, []);

  const login = async (username, password) => {
    const data = await apiFetch('/login', { method: 'POST', body: { username, password } });
    await saveToken(data.token);
    setToken(data.token);
    setUser(decodeJwt(data.token));
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
