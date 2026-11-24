import { createContext, useContext, useEffect, useState } from 'react';
import { setUnauthorizedHandler } from '../api/apiClient.js';
import { login as loginService, logout as logoutService, restoreSession } from './auth.service.js';
import { getSession } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());
  const [booting, setBooting] = useState(true);
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    let active = true;

    setUnauthorizedHandler(() => {
      logoutService();
      if (active) {
        setSession(null);
        setAuthMessage('Tu sesión expiró. Inicia sesión nuevamente.');
      }
    });

    (async () => {
      try {
        const restored = await restoreSession();
        if (!active) {
          return;
        }
        if (restored.expired) {
          setSession(null);
          setAuthMessage('Tu sesión expiró. Inicia sesión nuevamente.');
        } else {
          setSession(getSession());
        }
      } catch {
        if (!active) {
          return;
        }
        setSession(null);
        setAuthMessage('No se pudo restaurar la sesión. Inicia sesión nuevamente.');
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    })();

    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  async function login(credentials) {
    await loginService(credentials);
    const current = getSession();
    setAuthMessage('');
    setSession(current);
    return current;
  }

  function logout() {
    logoutService();
    setAuthMessage('');
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        booting,
        authMessage,
        setAuthMessage,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}
