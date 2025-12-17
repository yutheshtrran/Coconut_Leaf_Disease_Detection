import React, { createContext, useState, useEffect, useContext } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authService.getCurrentUser();
        setUser(res.user || null);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    const data = await authService.register(payload);
    // registration now uses a two-step flow: start (send code) then confirm
    return data;
  };

  const confirmRegistration = async (payload) => {
    const data = await authService.confirmRegister(payload);
    if (data && data.user) setUser(data.user);
    return data;
  };

  const verifyEmail = async (token) => {
    const res = await authService.verifyEmail(token);
    return res;
  };

  const resetPassword = async (token, newPassword) => {
    const res = await authService.resetPassword(token, newPassword);
    return res;
  };

  const resendVerification = async (email) => {
    const res = await authService.resendVerification(email);
    return res;
  };

  const resendPending = async (email) => {
    const res = await authService.resendPending(email);
    return res;
  };

  const verificationStatus = async (email) => {
    const res = await authService.verificationStatus(email);
    return res;
  };

  const forgotConfirm = async (payload) => {
    const res = await authService.forgotConfirm(payload);
    return res;
  };

  const forgotPassword = async (email) => {
    const res = await authService.forgotPassword(email);
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, confirmRegistration, logout, verifyEmail, resetPassword, resendVerification, resendPending, verificationStatus, forgotPassword, forgotConfirm }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
