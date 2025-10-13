import React from 'react';

const Sidebar = ({ currentScreen, onNavigate }) => {
  return (
    <div className="bg-gray-800 text-white w-64 h-full">
      <h2 className="text-2xl font-bold p-4">Coconut Leaf Detection</h2>
      <ul className="mt-6">
        <li
          className="p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </li>
        <li
          className="p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onNavigate('reports')}
        >
          Reports
        </li>
        <li
          className="p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onNavigate('my-farms')}
        >
          My Farms
        </li>
        <li
          className="p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onNavigate('alert-settings')}
        >
          Alerts
        </li>
        <li
          className="p-4 hover:bg-gray-700 cursor-pointer"
          onClick={() => onNavigate('user-management')}
        >
          User Management
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
