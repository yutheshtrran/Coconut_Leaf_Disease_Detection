import React, { useState } from "react";
import { LayoutDashboard, FileText, Map, Users, TrendingUp, Info, LogOut, Menu, X, Leaf, Bell } from "lucide-react";
import NavLink from "./NavLink.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle.jsx";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { name: "Drone Analysis", icon: TrendingUp, to: "/upload" },
  { name: "Analyse Images", icon: Leaf, to: "/analyse-images" },
  { name: "Reports", icon: FileText, to: "/reports" },
  { name: "My Farms", icon: Map, to: "/MyFarms" },
  { name: "Diseases", icon: FileText, to: "/diseases", adminOnly: true },
  { name: "User Management", icon: Users, to: "/users", adminOnly: true },
];

const Sidebar = () => {
  const logoColor = "#4CAF50";
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = (user?.username || user?.name || "User").trim();
  const roleLabel = user?.role === 'admin' ? 'Admin' : 'User';
  const initial = (displayName[0] || 'U').toUpperCase();
  const avatarUrl = user?.profileImageUrl;

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const SidebarContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full ${isMobile ? 'w-72' : 'w-64'}`}>
      {/* Logo Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <Link to="/dashboard" className="flex items-center" onClick={isMobile ? closeMobileMenu : undefined}>
          <span className="text-3xl mr-2">🥥</span>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: logoColor }}>
            Coco-Guard
          </h1>
        </Link>
        {isMobile && (
          <button onClick={closeMobileMenu} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-grow p-3 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.adminOnly || user?.role === 'admin')
          .map((item) => (
            <div key={item.name} onClick={isMobile ? closeMobileMenu : undefined}>
              <NavLink name={item.name} icon={item.icon} to={item.to} />
            </div>
          ))}

        {/* About Us Link */}
        <div onClick={isMobile ? closeMobileMenu : undefined}>
          <NavLink name="About Us" icon={Info} to="/about" />
        </div>
      </nav>

      {/* User Profile */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700">
        <div
          onClick={() => { navigate("/admin"); if (isMobile) closeMobileMenu(); }}
          className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-green-200" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100 font-bold text-sm">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Logout Button with Theme Toggle */}
      <div className="p-3 pt-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg fixed top-0 left-0 z-50 transition-colors duration-300">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          {/* Sidebar Panel */}
          <div className="absolute left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-2xl animate-slide-in">
            <SidebarContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[90vw] max-w-md p-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Confirm Logout</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to log out?</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white flex items-center gap-2"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
    </>
  );
};

export default Sidebar;
