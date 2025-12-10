import React, { useState } from 'react';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  // show/hide handled by PasswordField now
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

    const { user, login } = useAuth();
  const navigate = useNavigate();

    // If already logged in, redirect to dashboard
    React.useEffect(() => {
      if (user) navigate('/dashboard');
    }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      displayMessage('Password must be at least 6 characters long!');
      return;
    }
    setLoading(true);
    try {
      await login({ emailOrUsername: email, password });
      displayMessage('Login successful — redirecting...');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      displayMessage(msg);
      // If not verified, user must complete verification flow (register -> verify)
    } finally {
      setLoading(false);
    }
  };

  // LeftPanel/RightPanel and PalmTreeLogo are provided by AuthLayout now.

  const rightContent = (
    <>
      {message && <div className="fixed top-4 z-50 p-4 bg-yellow-400 text-gray-900 rounded-lg shadow-xl">{message}</div>}
      <div className="w-full max-w-md">
        {message && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">{message}</div>
        )}
        <p className="text-gray-500 mb-8">Sign in to your CocoGuard account to manage your farms</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
              placeholder="admin@cocoguard.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div>
              <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150" placeholder="Enter your password" required />
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center">
              <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 text-[#387637] border-gray-300 rounded focus:ring-[#387637]" />
              <label htmlFor="remember-me" className="ml-2 text-gray-600 select-none">Remember me</label>
            </div>
            <a href="/forgot-password" className="font-medium text-sm text-[#387637] hover:text-green-700 transition duration-150">Forgot password?</a>
            {showResend && (
              <div className="mt-2">
                <button type="button" onClick={async () => {
                  try {
                    setResendStatus('Checking...');
                    const s = await verificationStatus(email);
                    setResendStatus('Sending...');
                    if (s.pending) {
                      await resendPending(email);
                      setResendStatus('Registration code resent');
                    } else {
                      await resendVerification(email);
                      setResendStatus('Verification email resent');
                    }
                  } catch (e) {
                    setResendStatus(e?.response?.data?.message || 'Could not resend');
                  }
                }} className="text-sm text-[#387637] hover:text-green-700">Resend verification</button>
                {resendStatus && <div className="text-xs text-gray-600 mt-1">{resendStatus}</div>}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-lg font-medium text-white bg-[#387637] hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#387637] transition duration-200 disabled:opacity-50">
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <div>
            Don't have an account? <Link to="/register" className="font-medium text-[#387637] hover:text-green-700">Create account</Link>
          </div>
        </div>
      </div>
    </>
  );

  return <AuthLayout title="Welcome back">{rightContent}</AuthLayout>;
};

export default Login;
