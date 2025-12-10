import React, { useState, useEffect } from 'react';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);

  const { user, register, confirmRegistration } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      displayMessage('Password must be at least 6 characters long!');
      return;
    }
    if (password !== confirmPassword) {
      displayMessage('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register({ username, email, password });
      // Navigate to verification page to enter 6-character code
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      displayMessage(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // LeftPanel/RightPanel and PalmTreeLogo are provided by AuthLayout now.

  const rightContent = (
    <>
      {message && (
        <div className="fixed top-4 z-50 p-4 bg-yellow-400 text-gray-900 rounded-lg shadow-xl">
          {message}
        </div>
      )}
      <div className="w-full max-w-md">
        <p className="text-gray-500 mb-8">Register to start protecting your coconut farms.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
              placeholder="Your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
              placeholder="Create a password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <PasswordField
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
              placeholder="Confirm your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-lg font-medium text-white bg-[#387637] hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#387637] transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        {registered ? (
          <div className="mt-6 text-sm text-center">
            <p className="mb-3">A verification code was sent to <strong>{registeredEmail}</strong>. Enter it below.</p>
            <div className="flex items-center justify-center gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="px-3 py-2 border rounded-md"
              />
              <button onClick={async () => {
                try {
                  setLoading(true);
                  const resp = await confirmRegistration({ email: registeredEmail, code });
                  if (resp && resp.user) {
                    displayMessage('Registration complete — you are now logged in');
                    navigate('/dashboard');
                  } else {
                    displayMessage(resp?.message || 'Could not confirm registration');
                  }
                } catch (e) {
                  displayMessage(e?.response?.data?.message || 'Confirmation failed');
                } finally {
                  setLoading(false);
                }
              }} className="px-4 py-2 bg-[#387637] text-white rounded-md">Confirm</button>
            </div>
            {/* Resend removed — registration flow requires initial verification code only */}
          </div>
        ) : (
          <div className="mt-6 text-sm text-center">
            Already have an account? <Link to="/login" className="text-[#387637] font-medium">Sign in</Link>
          </div>
        )}
      </div>
    </>
  );

  return <AuthLayout title="Create account">{rightContent}</AuthLayout>;
};

export default Register;
