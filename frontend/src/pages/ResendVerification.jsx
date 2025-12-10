import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function ResendVerification() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(null); // 'pending' | 'user' | null
  const { resendVerification, resendPending, verificationStatus } = useAuth();

  const check = async (e) => {
    e.preventDefault();
    setStatus(null);
    try {
      const s = await verificationStatus(email);
      if (s.pending) {
        setMode('pending');
        setStatus('Pending registration found. You can resend the registration code.');
      } else if (s.userExists && !s.emailVerified) {
        setMode('user');
        setStatus('An unverified account exists. You can resend a verification email.');
      } else {
        setMode(null);
        setStatus('If an account exists, instructions will be sent.');
      }
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Error checking status');
    }
  };

  const doResend = async () => {
    setStatus(null);
    try {
      if (mode === 'pending') {
        const res = await resendPending(email);
        setStatus(res.message || 'If that email has a pending registration, a code was sent.');
      } else {
        const res = await resendVerification(email);
        setStatus(res.message || 'If that email exists, a verification email was sent.');
      }
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Error sending');
    }
  };

  const content = (
    <>
      <label className="block mb-2">Email</label>
      <div className="flex gap-2 mb-4">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="flex-1 p-2 border rounded" required />
        <button onClick={check} className="bg-gray-200 p-2 rounded">Check</button>
        <button type="button" onClick={doResend} className="bg-[#387637] text-white p-2 rounded">Resend</button>
      </div>
      {status && <p className="mt-3">{status}</p>}
      {mode === 'pending' && <p className="mt-2 text-sm text-gray-600">Pending registration found — we will resend the 6-character code.</p>}
      {mode === 'user' && <p className="mt-2 text-sm text-gray-600">An existing unverified account was found — we will resend the verification email.</p>}
    </>
  );

  return <AuthLayout title="Resend Verification">{content}</AuthLayout>;
}
