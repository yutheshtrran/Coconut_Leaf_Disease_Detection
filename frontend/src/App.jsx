// frontend/src/App.jsx
import React, { useState } from 'react';
// Import the components from their new location
import { Sidebar } from './components/Sidebar'; 

// Placeholder pages (you will implement these later in frontend/src/pages/)
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { MyFarms } from './pages/MyFarms'; 
import { AlertSettings } from './pages/Alerts'; // Renamed to Alerts
import { UserManagement } from './pages/UserManagement';

export default function App() {
  // Initialize state to the 'my-farms' screen to show the design you created
  const [currentScreen, setCurrentScreen] = useState('my-farms'); 

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Pass the state and the setter function as props */}
      <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      
      <main className="flex-1 overflow-y-auto">
        {/* Conditional Rendering based on state */}
        {currentScreen === 'dashboard' && <Dashboard />}
        {currentScreen === 'reports' && <Reports />}
        {currentScreen === 'my-farms' && <MyFarms />}
        {currentScreen === 'alert-settings' && <AlertSettings />}
        {currentScreen === 'user-management' && <UserManagement />}
      </main>
    </div>
  );
}