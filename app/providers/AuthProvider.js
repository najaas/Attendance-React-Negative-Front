import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadToken, saveToken, clearToken } from '../../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken().then((t) => {
      if (t) {
        setToken(t);
        setUser({ username: 'offline', role: 'employee' });
      }
      setLoading(false);
    });
  }, []);

  const login = async (username, password) => {
    const fakeToken = 'offline-demo-token';
    await saveToken(fakeToken);
    setToken(fakeToken);
    setUser({ username, role: 'employee' });
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

export default AuthProvider;
