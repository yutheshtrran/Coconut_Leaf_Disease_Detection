import React, { useState } from "react";
import PasswordField from './PasswordField';
import { Key, Lock, Shield, ShieldCheck, Save, AlertCircle, CheckCircle } from "lucide-react";

const Security = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000); // Notification disappears after 4 seconds
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (newPassword.trim() || confirmPassword.trim()) {
      // Logic for password update
      if (newPassword !== confirmPassword) {
        showNotification("error", "Error: New passwords do not match!");
        return;
      }
      if (currentPassword === "") {
        showNotification("error", "Error: Current password is required to set a new password.");
        return;
      }
      // Assuming a successful API call here
      showNotification("success", "Password updated and security settings saved!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
       // Logic for 2FA only update
       showNotification("success", "Two-Factor Authentication setting saved successfully!");
    }
  };

  return (
    // Adopted the modern, centered background layout from Profile.jsx
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8 pt-16">
      
      {/* Dynamic Notification Component */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 transition-opacity duration-300 transform ${
            notification.type === 'success' 
              ? 'bg-green-600 text-white animate-pulse-once' 
              : 'bg-red-600 text-white animate-pulse-once'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <p className="font-semibold">{notification.message}</p>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-green-800 mb-8 tracking-tight flex items-center gap-3">
        <Shield size={32} className="text-green-600" /> Account Security
      </h1>

      {/* Enhanced Card Styling */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-4xl">
        
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b border-gray-200">
          Change Password
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Current Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Lock size={16} className="text-green-500" /> Current Password
            </label>
            <PasswordField
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Key size={16} className="text-green-500" /> New Password
              </label>
              <PasswordField
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Must be at least 8 characters"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Key size={16} className="text-green-500" /> Confirm New Password
              </label>
              <PasswordField
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
              />
            </div>
          </div>
          
          <div className="text-sm text-gray-500 pt-2">
            Tip: Use a mix of upper/lowercase letters, numbers, and symbols for a strong password.
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 mb-4 pt-6 border-t border-gray-100">
            Two-Factor Authentication
          </h2>

          {/* Two-Factor Authentication Toggle (Enhanced UI) */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
                <ShieldCheck size={24} className={twoFA ? "text-green-600" : "text-gray-400"} />
                <div>
                    <p className="font-semibold text-gray-800">Enable 2FA</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Add an extra layer of security requiring a code from your phone.
                    </p>
                </div>
            </div>
            
            {/* Custom Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={twoFA}
                onChange={() => setTwoFA(!twoFA)}
                className="sr-only peer"
              />
              <div 
                className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"
              ></div>
            </label>
          </div>

          {/* Save Button */}
          <div className="pt-8 flex justify-end">
            <button
              type="submit"
              // Enhanced button style for a more professional look
              className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Save size={20} />
              Update Security
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Security;