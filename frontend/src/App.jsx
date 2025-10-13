// frontend/src/App.jsx
import React, { useState } from 'react';
// Import the Sidebar component
import Sidebar from './components/Sidebar'; 

// Import pages
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import MyFarms from './pages/MyFarms';
import Alerts from './pages/Alerts'; // Updated naming
import UserManagement from './pages/UserManagement';

export default function App() {
  // State to track the current screen
  const [currentScreen, setCurrentScreen] = useState('my-farms');

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar receives current screen and navigation handler */}
      <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />

      <main className="flex-1 overflow-y-auto">
        {/* Render pages conditionally based on currentScreen */}
        {currentScreen === 'dashboard' && <Dashboard />}
        {currentScreen === 'reports' && <Reports />}
        {currentScreen === 'my-farms' && <MyFarms />}
        {currentScreen === 'alert-settings' && <Alerts />}
        {currentScreen === 'user-management' && <UserManagement />}
      </main>
    </div>
  );
}
