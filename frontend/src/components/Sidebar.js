import React from 'react';

const Sidebar = () => {
    return (
        <div className="bg-gray-800 text-white w-64 h-full">
            <h2 className="text-2xl font-bold p-4">Coconut Leaf Detection</h2>
            <ul className="mt-6">
                <li className="p-4 hover:bg-gray-700 cursor-pointer">Dashboard</li>
                <li className="p-4 hover:bg-gray-700 cursor-pointer">Upload</li>
                <li className="p-4 hover:bg-gray-700 cursor-pointer">Reports</li>
                <li className="p-4 hover:bg-gray-700 cursor-pointer">Alerts</li>
                <li className="p-4 hover:bg-gray-700 cursor-pointer">Settings</li>
            </ul>
        </div>
    );
};

export default Sidebar;