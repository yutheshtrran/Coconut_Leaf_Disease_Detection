import React, { useState } from 'react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const displayMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.length < 6) {
      displayMessage('Password must be at least 6 characters long!');
      return;
    }
    setLoading(true);
    console.log('Attempting login with:', { email, password, rememberMe });
    setTimeout(() => {
      displayMessage('Login submitted! Check console.');
      setLoading(false);
    }, 1500);
  };

  const PalmTreeLogo = () => (
    <svg
      className="w-8 h-8 mr-2 text-white"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v20" />
      <path d="M17 7c-2 2-2 7-2 7s-5 0-7 2"/>
      <path d="M7 7c2 2 2 7 2 7s5 0 7 2"/>
      <path d="M12 2l-3 3" />
      <path d="M12 2l3 3" />
    </svg>
  );

  const LeftPanel = () => (
    <div className="flex flex-col justify-between p-8 md:p-16 w-full md:w-5/12 text-white min-h-[300px] md:min-h-full bg-[#387637] relative overflow-hidden rounded-t-xl md:rounded-l-xl md:rounded-tr-none">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute -right-24 -bottom-24 text-[150px] transform rotate-12 select-none"
          style={{ filter: 'grayscale(100%) blur(3px)' }}
        >
          🌴
        </div>
        <div
          className="absolute left-0 top-0 text-7xl transform -rotate-45 select-none"
          style={{ filter: 'grayscale(100%) blur(3px)' }}
        >
          🌿
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center mb-16">
          <PalmTreeLogo />
          <span className="text-xl font-semibold">CocoGuard</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
          Smart Coconut Farm Management
        </h1>
        <p className="text-lg mb-12 opacity-90">
          Monitor your plantation health with advanced drone analytics and real-time insights.
        </p>

        <div className="space-y-6">
          {[
            { title: 'Real-time Monitoring', desc: 'Track plantation health across all your farms' },
            { title: 'Drone Analytics', desc: 'Advanced flight data analysis and reporting' },
            { title: 'Smart Alerts', desc: 'Get notified of critical farm conditions' },
          ].map((feature, index) => (
            <div key={index} className="flex items-start">
              <span className="text-[#A4C936] text-2xl mr-4 mt-0.5 font-bold">✓</span>
              <div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="opacity-80 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-16 text-sm opacity-70 relative z-10">
        © 2025 CocoGuard. All rights reserved.
      </p>
    </div>
  );

  const RightPanel = () => (
    <div className="w-full md:w-7/12 p-8 md:p-16 flex items-center justify-center bg-white rounded-b-xl md:rounded-r-xl md:rounded-bl-none">
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome back</h2>
        <p className="text-gray-500 mb-8">
          Sign in to your CocoGuard account to manage your farms
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-[#387637] focus:border-[#387637] transition duration-150 pr-10"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.975 9.975 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.879 16.121A9.95 9.95 0 0112 17c4.478 0 8.268-2.943 9.543-7a9.975 9.975 0 00-1.563-3.029m-5.858.908l-2.618 2.618m0 0l-2.618-2.618"
                    />
                  ) : (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-[#387637] border-gray-300 rounded focus:ring-[#387637]"
              />
              <label htmlFor="remember-me" className="ml-2 text-gray-600 select-none">
                Remember me
              </label>
            </div>
            <a
              href="#"
              className="font-medium text-sm text-[#387637] hover:text-green-700 transition duration-150"
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-lg font-medium text-white bg-[#387637] hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#387637] transition duration-200 disabled:opacity-50"
          >
            {loading ? (
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          Need help?{' '}
          <a
            href="#"
            className="font-medium text-[#387637] hover:text-green-700 transition duration-150"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-[Inter] bg-gray-100 p-4">
      {message && (
        <div className="fixed top-4 z-50 p-4 bg-yellow-400 text-gray-900 rounded-lg shadow-xl animate-bounce">
          {message}
        </div>
      )}
      <main className="flex flex-col md:flex-row w-full max-w-7xl shadow-2xl rounded-xl overflow-hidden min-h-[600px] bg-white">
        {LeftPanel()}
        {RightPanel()}
      </main>
    </div>
  );
};

export default Login;
