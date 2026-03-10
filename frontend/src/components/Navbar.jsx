import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// Inline SVG icons
const MenuIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = [
    { name: 'About Us', path: '/about' },
  ];

  return (
    <nav className="fixed w-full z-20 top-0 bg-green-500/10 backdrop-blur-lg shadow-xl border-b border-green-300/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-green-900 text-3xl font-extrabold cursor-pointer hover:text-green-700 transition">
              🥥 Coco-Guard
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition duration-200 ease-in-out
                  ${location.pathname === item.path
                    ? 'bg-green-600 text-white shadow-lg transform scale-105'
                    : 'text-green-800 hover:bg-green-100/50 hover:text-green-900'
                  }`}
              >
                {item.name}
              </Link>
            ))}
            {!user && (
              <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-bold text-green-800 hover:bg-green-100/50">Login</Link>
            )}
            {!user && (
              <Link to="/register" className="px-4 py-2 rounded-xl text-sm font-bold text-green-800 hover:bg-green-100/50">Register</Link>
            )}
            {user && (
              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-green-800 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-600 transition duration-150"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <div className={`sm:hidden ${isMenuOpen ? 'block' : 'hidden'} absolute w-full bg-green-500/20 backdrop-blur-xl z-10 transition-all duration-300 ease-out border-b border-green-300/30`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-base font-medium transition duration-200 ease-in-out
                ${location.pathname === item.path
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-green-800 hover:bg-green-100/70 hover:text-green-900'
                }`}
            >
              {item.name}
            </Link>
          ))}
          {user && (
            <>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-green-800 font-medium">Theme</span>
                <ThemeToggle />
              </div>
              <button
                onClick={() => { setIsMenuOpen(false); setShowLogoutConfirm(true); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-base font-medium bg-red-600 text-white hover:bg-red-700"
              >
                <LogOut size={18} /> Logout
              </button>
            </>
          )}
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-md p-6">
            <h2 className="text-xl font-semibold mb-3">Confirm Logout</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-200"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white flex items-center gap-2"
                onClick={async () => { setIsLoggingOut(true); try { await logout(); navigate('/login'); } finally { setIsLoggingOut(false); setShowLogoutConfirm(false); } }}
                disabled={isLoggingOut}
              >
                {isLoggingOut && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                )}
                {isLoggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
