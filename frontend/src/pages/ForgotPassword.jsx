import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import AuthLayout from '../components/AuthLayout';
import CodeInput from '../components/CodeInput';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const { forgotPassword } = useAuth();
  const { forgotConfirm } = useAuth();
  const [step, setStep] = useState('start'); // start -> confirm
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await forgotPassword(email);
      setStatus(res.message || 'If that email exists, a reset code was sent.');
      setStep('confirm');
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Error sending reset');
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    try {
      const res = await forgotConfirm({ email, code, password: newPassword });
      setStatus(res.message || 'Password reset successful');
      setStep('done');
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Error resetting password');
    }
  };

  const content = (
    <>
      {step === 'start' && (
        <form onSubmit={submit}>
          <label className="block mb-2">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 mb-4 border rounded" required />
          <button className="w-full bg-[#387637] text-white p-3 rounded">Send Reset Code</button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={confirm}>
          <label className="block mb-2">Enter reset code</label>
          <CodeInput length={6} value={code} onChange={setCode} />
          <label className="block mb-2 mt-4">New password</label>
          <PasswordField value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 mb-4 border rounded" required />
          <button className="w-full bg-[#387637] text-white p-3 rounded">Reset Password</button>
        </form>
      )}

      {step === 'done' && <p className="mt-3">{status || 'Password reset. You can now log in.'}</p>}
      {status && step !== 'done' && <p className="mt-3">{status}</p>}
    </>
  );

  return <AuthLayout title="Forgot Password">{content}</AuthLayout>;
}
