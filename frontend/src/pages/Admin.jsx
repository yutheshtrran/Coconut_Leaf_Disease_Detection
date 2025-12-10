import React, { useState } from "react";
import Profile from "../components/Profile";
import Security from "../components/Security";
import Notifications from "../components/Notifications";
import Activity from "../components/Activity";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("Profile");

  const renderSection = () => {
    switch (activeTab) {
      case "Profile":
        return <Profile />;
      case "Security":
        return <Security />;
      case "Notifications":
        return <Notifications />;
      case "Activity":
        return <Activity />;
      default:
        return <Profile />;
    }
  };

  return (
    <div className="flex min-h-screen bg-green-50 mt-[2cm]">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-green-200 p-6 ml-60">
        <h2 className="text-2xl font-bold text-green-800 mb-6 text-center">
          Profile
        </h2>

        <nav className="space-y-3">
          {["Profile", "Security", "Notifications", "Activity"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? "bg-green-600 text-white shadow-md"
                  : "text-green-800 hover:bg-green-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{renderSection()}</main>
    </div>
  );
};

export default Admin;
