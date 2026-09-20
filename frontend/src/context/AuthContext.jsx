import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken, clearTokens } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on page mount by attempting token refresh with cookie
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await api.post('/auth/refresh');
        if (res.data?.data?.access_token) {
          setAccessToken(res.data.data.access_token);
          const meRes = await api.get('/auth/me');
          setUser(meRes.data?.data?.user || null);
        }
      } catch {
        // Logged out / guest visitor
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: loggedInUser, access_token } = res.data.data;
    setAccessToken(access_token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    const { user: registeredUser, access_token } = res.data.data;
    setAccessToken(access_token);
    setUser(registeredUser);
    return registeredUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const isCustomer = user?.role === 'customer';
  const isSeller = user?.role === 'seller';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isCustomer,
        isSeller,
        isAdmin,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
