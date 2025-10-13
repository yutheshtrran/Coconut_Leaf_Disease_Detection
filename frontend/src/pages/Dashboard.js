import React from 'react';

const Dashboard = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1 className="text-4xl font-bold mb-4">Coconut Leaf Detection Dashboard</h1>
            <p className="text-lg text-gray-700">Welcome to the Coconut Leaf Detection application. Here you can upload images, view reports, and monitor alerts.</p>
            <div className="mt-8">
                <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Upload Image
                </button>
                <button className="ml-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                    View Reports
                </button>
                <button className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                    Check Alerts
                </button>
            </div>
        </div>
    );
};

export default Dashboard;