import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import CodeInput from '../components/CodeInput';
import Toast from '../components/Toast';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const { confirmRegistration, resendPending, verificationStatus, verifyEmail, resendVerification } = useAuth();
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (token) {
        // Legacy token-based verification is not supported by the code-based flow.
        setStatus('Legacy token verification is not supported here. Please enter the 6-character code from your email.');
        return;
      }

      if (!email) return setStatus('No token or email provided');
      try {
        const s = await verificationStatus(email);
        setStatus('Enter the 6-character code sent to your email');
        setMode(s.pending ? 'pending' : (s.userExists ? 'user' : 'unknown'));
      } catch (err) {
        setStatus(err?.response?.data?.message || 'Could not determine verification status');
      }
    })();
  }, [token, email]);

  const doVerify = async () => {
    setLoading(true);
    try {
      if (mode === 'pending') {
        const resp = await confirmRegistration({ email, code });
        if (resp && resp.user) {
          setStatus('Verified — redirecting...');
          setTimeout(() => navigate('/dashboard'), 1000);
        } else {
          setStatus(resp?.message || 'Verification failed');
        }
      } else if (mode === 'user') {
        const resp = await verifyEmail({ email, code });
        if (resp) {
          setStatus('Email verified — please login');
          setTimeout(() => navigate('/login'), 1000);
        } else {
          setStatus(resp?.message || 'Verification failed');
        }
      } else {
        setStatus('No pending or unverified user found for that email');
      }
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Confirmation error');
    } finally {
      setLoading(false);
    }
  };

  const doResend = async () => {
    try {
      if (mode === 'pending') await resendPending(email);
      else await resendVerification(email);
      setStatus('Verification code resent');
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Could not resend');
    }
  };

  const content = (
    <>
      <Toast type={status && status.toLowerCase().includes('verified') ? 'success' : (status && status.toLowerCase().includes('fail') ? 'error' : 'info')} message={status} onClose={() => setStatus('')} />

      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-600 hover:text-[#387637] transition-colors rounded-full hover:bg-gray-100"
          title="Go back"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {email && (
        <>
          <CodeInput length={6} value={code} onChange={setCode} />
          <div className="flex gap-3 mt-6">
            <button onClick={doVerify} disabled={loading} className="flex-1 bg-[#387637] text-white p-3 rounded">{loading ? 'Verifying...' : 'Verify'}</button>
            <button onClick={doResend} className="flex-1 bg-gray-200 p-3 rounded">Resend</button>
          </div>
        </>
      )}
    </>
  );

  return <AuthLayout title="Verify Email">{content}</AuthLayout>;
}
