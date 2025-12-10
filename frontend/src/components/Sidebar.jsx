import React from "react";
import { LayoutDashboard, FileText, Map, Bell, Users, Settings, TrendingUp } from "lucide-react";
import NavLink from "./NavLink.jsx";
import { useNavigate } from "react-router-dom"; // <-- Add this

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, to: "/" },
  { name: "Drone Analysis", icon: TrendingUp, to: "/upload" },
  { name: "Reports", icon: FileText, to: "/reports" },
  { name: "My Farms", icon: Map, to: "/MyFarms" },
  { name: "Alert Settings", icon: Bell, to: "/alerts" },
  { name: "User Management", icon: Users, to: "/users" },
];

const Sidebar = () => {
  const logoColor = "#4CAF50";
  const navigate = useNavigate(); // <-- Initialize navigation hook

  return (
    <div className="flex flex-col h-screen w-64 bg-white border-r border-gray-200 shadow-lg fixed">
      {/* Logo */}
      <div className="flex items-center p-6 border-b border-gray-100">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center mr-2 shadow-inner"
          style={{ backgroundColor: "#e8e8e8" }}
        >
          <Settings className="w-5 h-5" style={{ color: logoColor }} />
        </div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: logoColor }}>
          CocoGuard
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.name} name={item.name} icon={item.icon} to={item.to} />
        ))}
      </nav>

      {/* Profile (Admin) */}
      <div className="p-4 border-t border-gray-100">
        <div
          onClick={() => navigate("/admin")} // <-- Add navigation here
          className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-200 text-green-800 font-bold text-lg">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Admin</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
