import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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

// Components
import Navbar from "./components/Navbar.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { Import } from "lucide-react";

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        {/* Sidebar fixed width */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Navbar */}
          <Navbar />

          {/* Page content */}
          <main className="flex-1 p-4 mt-0">
            {/* Remove fixed navbar padding since Navbar is not fixed */}
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
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
