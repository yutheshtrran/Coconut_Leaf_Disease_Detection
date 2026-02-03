import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// Pages
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Reports from "./pages/Reports.jsx";
import Alerts from "./pages/Alerts.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResendVerification from "./pages/ResendVerification.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import MyFarms from "./pages/MyFarms.jsx";
import Admin from "./pages/Admin.jsx";
import ManageDiseases from "./pages/ManageDiseases.jsx";

// Components
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ProtectedRoute from './components/ProtectedRoute.jsx';

function AppWrapper() {
  const location = useLocation();

  // Pages where Navbar and Sidebar should be hidden (auth and public entry pages)
  const blurLayoutPages = ["/", "/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/resend-verification"];

  const showBlurLayout = blurLayoutPages.includes(location.pathname.toLowerCase());
  const showLayout = !showBlurLayout;

  return (
    <div className="relative flex min-h-screen bg-gray-100">
      {/* Sidebar - only show when not on auth pages */}
      {showLayout && (
        <div className="flex-shrink-0">
          <Sidebar />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {showLayout && (
          <div>
            <Navbar />
          </div>
        )}

        <main className={`flex-1 p-0 ${showLayout ? 'p-4' : ''}`}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/resend-verification" element={<ResendVerification />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/diseases" element={<ProtectedRoute><ManageDiseases /></ProtectedRoute>} />

            {/* Protected routes - require login */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/myfarms"
              element={
                <ProtectedRoute>
                  <MyFarms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;
