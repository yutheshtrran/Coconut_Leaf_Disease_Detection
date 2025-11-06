import React, { useState } from "react";
import { Bell, Mail, MessageSquare, Monitor, Save, CheckCircle } from "lucide-react";

const Notifications = () => {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [notification, setNotification] = useState(null); // { type: 'success', message: string }

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000); // Notification disappears after 4 seconds
  };

  const handleSave = () => {
    // Use the custom notification instead of alert()
    showNotification("success", "Notification preferences updated successfully!");
  };

  // Helper component for the custom toggle row
  const NotificationToggle = ({ icon: Icon, title, description, checked, onChange }) => (
    <div className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 transition hover:shadow-sm">
      <div className="flex items-start gap-4">
        <Icon size={24} className={checked ? "text-green-600 mt-1" : "text-gray-400 mt-1"} />
        <div>
          <p className="font-semibold text-gray-800">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      
      {/* Custom Toggle Switch (consistent with Security.jsx) */}
      <label className="relative inline-flex items-center cursor-pointer ml-4">
        <input 
          type="checkbox" 
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div 
          className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"
        ></div>
      </label>
    </div>
  );

  return (
    // Adopted the modern, centered background layout
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8 pt-16">
      
      {/* Dynamic Notification Component */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 bg-green-600 text-white rounded-xl shadow-2xl flex items-center gap-3 transition-opacity duration-300 transform animate-pulse-once`}
        >
          <CheckCircle size={20} />
          <p className="font-semibold">{notification.message}</p>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-green-800 mb-8 tracking-tight flex items-center gap-3">
        <Bell size={32} className="text-green-600" /> Notification Preferences
      </h1>

      {/* Enhanced Card Styling */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-4xl space-y-6">
        
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b border-gray-200">
          General Alerts
        </h2>

        <div className="space-y-4">
          
          {/* Email Alerts */}
          <NotificationToggle
            icon={Mail}
            title="Email Alerts"
            description="Receive important updates, appointment reminders, and changes via your registered email address."
            checked={emailAlerts}
            onChange={() => setEmailAlerts(!emailAlerts)}
          />

          {/* SMS Alerts */}
          <NotificationToggle
            icon={MessageSquare}
            title="SMS Alerts"
            description="Get urgent notifications and security alerts sent directly to your phone number."
            checked={smsAlerts}
            onChange={() => setSmsAlerts(!smsAlerts)}
          />

          {/* System Notifications */}
          <NotificationToggle
            icon={Monitor}
            title="In-App System Notifications"
            description="Show alerts directly within the Medilink application interface."
            checked={systemAlerts}
            onChange={() => setSystemAlerts(!systemAlerts)}
          />

        </div>

        {/* Save Button */}
        <div className="pt-8 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Save size={20} />
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notifications;