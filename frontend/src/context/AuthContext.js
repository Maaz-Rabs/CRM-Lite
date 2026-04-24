import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  verifyClientCode as verifyApi,
  loginApi,
  logoutApi,
  apiFetch as apiFetchUtil,
  getStoredUser,
  getStoredTokens,
  getStoredClient,
  getStoredPermissions,
  STORAGE_KEYS,
} from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [clientData, setClientData] = useState(null);
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored data on mount
  useEffect(() => {
    const stored = getStoredClient();
    if (stored) setClientData(stored);
    const u = getStoredUser();
    if (u) setUser(u);
    const t = getStoredTokens();
    if (t) setTokens(t);
    const p = getStoredPermissions();
    if (p) setPermissions(p);
    setIsLoading(false);
  }, []);

  const isAuthenticated = !!user && !!tokens?.access_token;
  const isClientVerified = !!clientData?.apiBaseUrl;

  const isAdmin = user?.role_slug === 'master' || user?.role_slug === 'admin';
  const isSalesManager = user?.role_slug === 'sales_manager';
  const isTeamLeader = user?.role_slug === 'team_leader';

  const verifyClientCode = useCallback(async (code) => {
    const result = await verifyApi(code);
    if (result.success) setClientData(result.data);
    return result;
  }, []);

  const login = useCallback(async (username, password) => {
    const result = await loginApi(username, password);
    if (result.success) {
      setUser(result.data.user);
      setTokens(result.data.tokens);
      setPermissions(result.data.permissions || []);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    logoutApi();
    setUser(null);
    setTokens(null);
    setPermissions([]);
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    return apiFetchUtil(endpoint, options);
  }, []);

  const value = {
    clientData, user, tokens, permissions,
    isLoading, isAuthenticated, isClientVerified,
    isAdmin, isSalesManager, isTeamLeader,
    verifyClientCode, login, logout, apiFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
