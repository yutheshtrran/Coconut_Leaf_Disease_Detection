import React, { useState } from "react";
import { Bell, Mail, MessageSquare, Monitor, Save, CheckCircle, Phone, Megaphone, Sparkles, User } from "lucide-react";

const Notifications = () => {
  // Contact details state
  const [emailAddress, setEmailAddress] = useState("user@example.com");
  const [phoneNumber, setPhoneNumber] = useState("+1-555-123-4567");

  // Alert preferences state
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [newFeatureAnnouncements, setNewFeatureAnnouncements] = useState(true);

  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSave = () => {
    showNotification("success", "Notification preferences updated successfully!");
  };

  // Toggle component with dark mode support
  const NotificationToggle = ({ icon: Icon, title, description, checked, onChange }) => (
    <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 transition hover:shadow-sm">
      <div className="flex items-start gap-4">
        <Icon size={24} className={checked ? "text-green-600 dark:text-green-400 mt-1" : "text-gray-400 dark:text-gray-500 mt-1"} />
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
      </label>
    </div>
  );

  return (
    <div className="flex flex-col items-center p-4 sm:p-6 w-full transition-colors duration-300">
      {/* Success Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-600 text-white rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle size={20} />
          <p className="font-semibold">{notification.message}</p>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-green-800 dark:text-green-400 mb-8 tracking-tight flex items-center gap-3">
        <Bell size={32} className="text-green-600 dark:text-green-500" /> Notification Settings
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-5xl transition-colors duration-300">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Contact Details */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-green-700 dark:text-green-400 pb-3 border-b border-gray-200 dark:border-gray-700">
              Contact Details
            </h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Mail size={16} className="text-green-500" /> Email Address
              </label>
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-green-500" /> Phone Number (for SMS Alerts)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1-555-123-4567"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right Column: Alert & Communication Channels */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-green-700 dark:text-green-400 pb-3 border-b border-gray-200 dark:border-gray-700">
              Alert & Communication Channels
            </h2>

            <div className="space-y-4">
              <NotificationToggle
                icon={Mail}
                title="Email Updates"
                description="Invoices, security alerts, essential service communication."
                checked={emailAlerts}
                onChange={() => setEmailAlerts(!emailAlerts)}
              />

              <NotificationToggle
                icon={MessageSquare}
                title="SMS Alerts"
                description="Critical service outages or account security warnings."
                checked={smsAlerts}
                onChange={() => setSmsAlerts(!smsAlerts)}
              />

              <NotificationToggle
                icon={Monitor}
                title="In-App Notifications"
                description="Visible in your dashboard notification center."
                checked={inAppAlerts}
                onChange={() => setInAppAlerts(!inAppAlerts)}
              />
            </div>
          </div>
        </div>

        {/* Promotional & Feature Updates - Full Width */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-green-700 dark:text-green-400 mb-6">
            Promotional & Feature Updates
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NotificationToggle
              icon={Megaphone}
              title="Marketing Emails & Promotions"
              description="Receive newsletters and special offers."
              checked={marketingEmails}
              onChange={() => setMarketingEmails(!marketingEmails)}
            />

            <NotificationToggle
              icon={Sparkles}
              title="New Feature Announcements"
              description="Get notified when we launch new tools."
              checked={newFeatureAnnouncements}
              onChange={() => setNewFeatureAnnouncements(!newFeatureAnnouncements)}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-8 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition duration-300 shadow-lg hover:shadow-xl"
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