import React, { useState } from "react";
import { User, Mail, Phone, BookOpen, Camera, Save, CheckCircle } from "lucide-react";

const Profile = () => {
  const [name, setName] = useState("Admin User");
  const [email, setEmail] = useState("admin@Cocoguard.com");
  const [phone, setPhone] = useState("+94 712 345 678");
  const [bio, setBio] = useState("System administrator for CocoGuard platform.");
  const [isSuccessVisible, setIsSuccessVisible] = useState(false); // State to manage success notification

  const handleSubmit = (e) => {
    e.preventDefault();
    // Replaced alert() with a custom state-based notification
    setIsSuccessVisible(true);
    setTimeout(() => {
      setIsSuccessVisible(false);
    }, 3000); // Notification disappears after 3 seconds
  };

  return (
    // Centering the container content and ensuring full screen height
    <div className="bg-gray-50 min-h-screen flex flex-col items-center p-4 sm:p-8 pt-16">
      
      {/* Success Notification */}
      {isSuccessVisible && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-green-600 text-white rounded-xl shadow-2xl flex items-center gap-3 transition-opacity duration-300 transform animate-pulse-once">
          <CheckCircle size={20} />
          <p className="font-semibold">Profile updated successfully!</p>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-green-800 mb-8 tracking-tight">
        My Profile Settings
      </h1>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-4xl">
        
        {/* --- Profile Header Section --- */}
        <div className="flex flex-col md:flex-row items-center gap-8 pb-6 border-b border-gray-200 mb-6">
          <div className="relative">
            {/* Improved Profile Placeholder/Image Styling */}
            <div className="rounded-full w-32 h-32 bg-green-100 flex items-center justify-center text-green-600 border-4 border-green-300 shadow-lg">
              <User size={64} /> {/* Placeholder icon */}
            </div>
            {/* Upload Button overlay for a slicker look */}
            <button
              className="absolute bottom-0 right-0 p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition duration-150 shadow-md border-2 border-white"
              aria-label="Change Profile Photo"
            >
              <Camera size={18} />
            </button>
          </div>
          
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-800 mb-1">{name}</h2>
            <p className="text-lg text-green-600 font-medium mb-1 flex items-center justify-center md:justify-start gap-2">
              <Mail size={16} />{email}
            </p>
            <p className="text-md text-gray-500 flex items-center justify-center md:justify-start gap-2">
              <Phone size={16} />{phone}
            </p>
          </div>
        </div>
        {/* --- End Profile Header Section --- */}

        {/* --- Profile Form Section --- */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name & Email in a responsive grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <User size={16} className="text-green-500" /> Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
              />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                <Mail size={16} className="text-green-500" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
              />
            </div>
          </div>

          {/* Phone Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Phone size={16} className="text-green-500" /> Phone Number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +94 77 123 4567"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
            />
          </div>

          {/* Bio Textarea */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <BookOpen size={16} className="text-green-500" /> Biography / Description
            </label>
            <textarea
              rows="4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us a little bit about your role or yourself..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-150"
            />
          </div>

          {/* Save Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Save size={20} />
              Save Changes
            </button>
          </div>
        </form>
        {/* --- End Profile Form Section --- */}
      </div>
    </div>
  );
};

export default Profile;