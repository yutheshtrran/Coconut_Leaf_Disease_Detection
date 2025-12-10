import React, { useState, useEffect } from 'react';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Toast from '../components/Toast';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('general');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);

  const { user, register, confirmRegistration, verificationStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };
  const displayToast = (msg, type = 'info') => {
    setToastType(type);
    setMessage(msg);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    // Strong password guidance
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setPasswordError('Use a strong password (8+ chars, upper, lower, number).');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Check if there's already a pending registration or existing user
      const status = await verificationStatus(email);
      if (status?.pending) {
        displayMessage('Pending registration found. Please verify your email.', 'info');
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      if (status?.userExists && status?.emailVerified) {
        setEmailError('This email is already verified. Please sign in.');
        return;
      }

      await register({ username, email, password, role });
      displayToast('Verification code sent to your email', 'success');
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      if (msg && msg.toLowerCase().includes('exists')) {
        setEmailError('This email or username is already registered.');
      } else {
        displayMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // LeftPanel/RightPanel and PalmTreeLogo are provided by AuthLayout now.

  const rightContent = (
    <>
      {/* Single Toast for notifications */}
      <Toast type={toastType} message={message} onClose={() => setMessage('')} />
      <div className="w-full max-w-md">
        <p className="text-gray-500 mb-8">Register to start protecting your coconut farms.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Type</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150"
            >
              <option value="farmer">Farmer</option>
              <option value="agronomist">Agronomist</option>
              <option value="general">General User</option>
            </select>
          </div>

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
              className={`w-full px-4 py-3 border ${emailError ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150`}
              placeholder="you@example.com"
              required
            />
            {emailError && <p className="mt-1 text-sm text-red-600">{emailError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 border ${passwordError ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150`}
              placeholder="Create a password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <PasswordField
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-4 py-3 border ${passwordError ? 'border-red-500' : 'border-gray-300'} rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150`}
              placeholder="Confirm your password"
              required
            />
            {passwordError && <p className="mt-1 text-sm text-red-600">{passwordError}</p>}
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
