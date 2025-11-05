import React, { useState, useEffect } from 'react';

const NotificationItem = ({ label, description, name, checked, onChange }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-200 last:border-b-0">
    <div className="flex flex-col pr-4">
      <span className="text-gray-800 font-medium text-base">{label}</span>
      <span className="text-sm text-gray-500 mt-0.5">{description}</span>
    </div>
    <input
      type="checkbox"
      name={name}
      checked={checked}
      onChange={onChange}
      className="w-5 h-5 mt-1 text-emerald-600 bg-white border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
    />
  </div>
);

const InputGroup = ({ label, name, type, value, onChange }) => (
  <div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition duration-150"
      placeholder={`Enter your ${label.toLowerCase()}`}
    />
  </div>
);

const Toast = ({ message, visible, onClose }) => {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white p-4 rounded-md shadow-2xl transition-opacity duration-300 opacity-100"
      role="alert"
    >
      <div className="flex items-center">
        <svg
          className="w-6 h-6 mr-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
        <p className="font-medium">{message}</p>
        <button onClick={onClose} className="ml-4 text-white hover:text-emerald-200">
          &times;
        </button>
      </div>
    </div>
  );
};

const Alerts = () => {
  const [settings, setSettings] = useState({
    emailUpdates: true,
    smsAlerts: false,
    appNotifications: true,
    marketingEmails: false,
    newFeatureAnnouncements: true,
  });

  const [recipient, setRecipient] = useState({
    phoneNumber: '+1-555-123-4567',
    emailAddress: 'user@example.com',
  });

  const [toast, setToast] = useState({ visible: false, message: '' });

  const handleToggleChange = (event) => {
    const { name, checked } = event.target;
    setSettings((prev) => ({ ...prev, [name]: checked }));
  };

  const handleRecipientChange = (event) => {
    const { name, value } = event.target;
    setRecipient((prev) => ({ ...prev, [name]: value }));
  };

  const showToast = (message) => setToast({ visible: true, message });

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => setToast({ visible: false, message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const handleSave = () => {
    console.log('Saving settings:', settings);
    console.log('Recipient details:', recipient);
    showToast('Settings saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ marginTop: '1cm' }}>
      {/* Wrapper div to shift content 5cm right */}
      <div style={{ marginLeft: '6cm', flex: 1 }}>
        <main className="p-6">
          <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
            {/* Header */}
            <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-300 flex items-center">
              <svg
                className="w-6 h-6 mr-3 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-2.81A3 3 0 0018 12h-1a3 3 0 00-3-3V5a2 2 0 10-4 0v4a3 3 0 00-3 3H5a3 3 0 00-1.595 2.19l-1.405 2.81h5m-2-5a2 2 0 114 0 2 2 0 01-4 0z"
                ></path>
              </svg>
              Notification Settings
            </h2>

            {/* Landscape layout: flex row */}
            <div className="flex flex-col lg:flex-row gap-6 mt-6">
              {/* Recipient Section */}
              <section className="flex-1 p-4 border border-gray-200 rounded-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  Contact Details
                </h3>
                <InputGroup
                  label="Email Address"
                  type="email"
                  name="emailAddress"
                  value={recipient.emailAddress}
                  onChange={handleRecipientChange}
                />
                <InputGroup
                  label="Phone Number (for SMS Alerts)"
                  type="tel"
                  name="phoneNumber"
                  value={recipient.phoneNumber}
                  onChange={handleRecipientChange}
                />
              </section>

              {/* Notification Preferences */}
              <section className="flex-1 p-4 border border-gray-200 rounded-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  Alert & Communication Channels
                </h3>

                <NotificationItem
                  label="Email Updates"
                  description="e.g., invoices, security alerts, essential service communication."
                  name="emailUpdates"
                  checked={settings.emailUpdates}
                  onChange={handleToggleChange}
                />

                <NotificationItem
                  label="SMS Alerts"
                  description="e.g., critical service outages or account security warnings."
                  name="smsAlerts"
                  checked={settings.smsAlerts}
                  onChange={handleToggleChange}
                />

                <NotificationItem
                  label="In-App Notifications"
                  description="Visible in your dashboard notification center."
                  name="appNotifications"
                  checked={settings.appNotifications}
                  onChange={handleToggleChange}
                />

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    Promotional & Feature Updates
                  </h3>
                </div>

                <NotificationItem
                  label="Marketing Emails & Promotions"
                  description="Receive newsletters and special offers."
                  name="marketingEmails"
                  checked={settings.marketingEmails}
                  onChange={handleToggleChange}
                />

                <NotificationItem
                  label="New Feature Announcements"
                  description="Get notified when we launch new tools and capabilities."
                  name="newFeatureAnnouncements"
                  checked={settings.newFeatureAnnouncements}
                  onChange={handleToggleChange}
                />
              </section>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="mt-6 w-full py-3 px-4 bg-emerald-600 text-white font-semibold text-lg rounded-md shadow-lg hover:bg-emerald-700 transition duration-200 ease-in-out"
            >
              Save Changes
            </button>
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast({ visible: false, message: '' })}
      />
    </div>
  );
};

export default Alerts;
