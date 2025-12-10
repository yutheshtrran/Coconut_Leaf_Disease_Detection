import API from './api';

export const register = async ({ username, email, password }) => {
  const res = await API.post('/auth/register', { username, email, password });
  return res.data;
};

export const confirmRegister = async ({ email, code }) => {
  const res = await API.post('/auth/register/confirm', { email, code });
  return res.data;
};

export const login = async ({ emailOrUsername, password }) => {
  const res = await API.post('/auth/login', { emailOrUsername, password });
  return res.data;
};

export const logout = async () => {
  const res = await API.post('/auth/logout');
  return res.data;
};

export const getCurrentUser = async () => {
  const res = await API.get('/auth/me');
  return res.data;
};

export const verifyEmail = async ({ email, code }) => {
  const res = await API.post('/auth/verify', { email, code });
  return res.data;
};

export const resetPassword = async (token, newPassword) => {
  const res = await API.post('/auth/reset', { token, password: newPassword });
  return res.data;
};

export const resendVerification = async (email) => {
  const res = await API.post('/auth/resend', { email });
  return res.data;
};

export const resendPending = async (email) => {
  const res = await API.post('/auth/register/resend', { email });
  return res.data;
};

export const verificationStatus = async (email) => {
  const res = await API.post('/auth/verification-status', { email });
  return res.data;
};

export const forgotConfirm = async ({ email, code, password }) => {
  const res = await API.post('/auth/forgot/confirm', { email, code, password });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await API.post('/auth/forgot', { email });
  return res.data;
};

const authService = { register, confirmRegister, login, logout, getCurrentUser, verifyEmail, resetPassword, resendVerification, resendPending, verificationStatus, forgotPassword, forgotConfirm };

export default authService;