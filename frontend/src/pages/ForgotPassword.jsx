import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import AuthLayout from '../components/AuthLayout';
import CodeInput from '../components/CodeInput';
import Toast from '../components/Toast';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const { forgotPassword } = useAuth();
  const { forgotConfirm } = useAuth();
  const [step, setStep] = useState('start'); // start -> confirm
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();

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
      <Toast type={step === 'done' ? 'success' : (status && status.toLowerCase().includes('error') ? 'error' : 'info')} message={status} onClose={() => setStatus(null)} />

      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate('/login')}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#387637] dark:hover:text-[#4CAF50] transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Back to Login"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {step === 'start' && (
        <form onSubmit={submit}>
          <label className="block mb-2 text-gray-700 dark:text-gray-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
            placeholder="Enter your email"
          />
          <button className="w-full bg-[#387637] hover:bg-[#2d602c] text-white p-3 rounded font-medium transition-colors">Send Reset Code</button>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={confirm}>
          <label className="block mb-2 text-gray-700 dark:text-gray-300">Enter reset code</label>
          <CodeInput length={6} value={code} onChange={setCode} />

          <label className="block mb-2 mt-6 text-gray-700 dark:text-gray-300">New password</label>
          <PasswordField
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
            placeholder="Enter new password"
          />
          <button className="w-full bg-[#387637] hover:bg-[#2d602c] text-white p-3 rounded font-medium transition-colors">Reset Password</button>
        </form>
      )}

      {step === 'done' && (
        <div className="mt-4 text-center">
          <p className="text-gray-800 dark:text-gray-200 mb-4">{status || 'Password reset. You can now log in.'}</p>
          <button onClick={() => navigate('/login')} className="bg-[#387637] text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">Go to Login</button>
        </div>
      )}
    </>
  );

  return <AuthLayout title="Forgot Password">{content}</AuthLayout>;
}
