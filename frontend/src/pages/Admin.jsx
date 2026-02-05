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
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 p-6 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
          Profile
        </h2>

        <nav className="space-y-3">
          {["Profile", "Security", "Notifications", "Activity"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${activeTab === tab
                ? "bg-green-600 text-white shadow-md"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">{renderSection()}</main>
    </div>
  );
};

export default Admin;
