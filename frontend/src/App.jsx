import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// Pages
import Dashboard from "./pages/Dashboard.jsx";
import Upload from "./pages/Upload.jsx";
import Reports from "./pages/Reports.jsx";
import Alerts from "./pages/Alerts.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import AboutUs from "./pages/AboutUs.jsx";
import MyFarms from "./pages/MyFarms.jsx";
import Admin from "./pages/Admin.jsx";

// Components
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";

function AppWrapper() {
  const location = useLocation();

  // Pages where Navbar and Sidebar should appear blurred behind login/register
  const blurLayoutPages = ["/login", "/register"];

  const showBlurLayout = blurLayoutPages.includes(location.pathname.toLowerCase());
  const showLayout = !showBlurLayout;

  return (
    <div className="relative flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 ${showBlurLayout ? "pointer-events-none filter blur-sm opacity-60" : ""}`}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className={`${showBlurLayout ? "pointer-events-none filter blur-sm opacity-60" : ""}`}>
          <Navbar />
        </div>

        <main className={`flex-1 p-4 ${showLayout ? "mt-0" : ""}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/myfarms" element={<MyFarms />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/admin" element={<Admin />} />
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
