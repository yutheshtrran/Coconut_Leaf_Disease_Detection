import React, { useState } from 'react';
import PasswordField from '../components/PasswordField';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  const { resetPassword } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    if (!token) return setStatus('No token provided');
    try {
      await resetPassword(token, password);
      setStatus('Password reset. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Reset failed');
    }
  };

  const content = (
    <>
      <form onSubmit={submit}>
        <label className="block mb-2">New password</label>
        <PasswordField value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 mb-4 border rounded" />
        <button className="w-full bg-[#387637] text-white p-3 rounded">Reset Password</button>
      </form>
      {status && <p className="mt-3">{status}</p>}
    </>
  );

  return <AuthLayout title="Reset Password">{content}</AuthLayout>;
}
