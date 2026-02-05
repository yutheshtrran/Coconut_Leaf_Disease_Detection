import React from 'react';

// Define the custom colors
const COLORS = {
    primaryGreen: '#4CAF50',
    alertRed: '#F44336',
    infoBlue: '#2196F3',
    trendYellow: '#FFC107',
    bgHeader: '#E8F5E9',
};

// Data for the top statistics cards
const STATS_DATA = [
    { title: "Total Farms Monitored", value: "12", color: 'border-green-500' },
    { title: "Critical Alerts", value: "3", color: 'border-red-500' },
    { title: "New Reports This Week", value: "5", color: 'border-blue-500' },
    {
        title: "Overall Health Trend", value: (
            <div className="flex items-center">
                <span className="mr-1">&uarr;</span>
                <span className="text-xl text-green-500">Improving</span>
            </div>
        ), color: 'border-yellow-500'
    },
];

// Data for latest analysis reports
const currentYear = new Date().getFullYear();
const REPORTS_DATA = [
    { farm: "Farm A - Plot 3", issue: "Major Issue", date: `${currentYear}-10-26`, color: COLORS.alertRed, className: 'text-red-600 font-semibold' },
    { farm: "Farm B - Plot 1", issue: "Nutrient Deficiency", date: `${currentYear}-10-25`, color: COLORS.trendYellow, className: 'text-yellow-500' },
    { farm: "Farm C - Plot 5", issue: "Minor Issue", date: `${currentYear}-10-24`, color: COLORS.primaryGreen, className: 'text-green-500' },
];

// Status Circle component
const StatusCircle = ({ color }) => (
    <svg className="w-3 h-3" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill={color} />
    </svg>
);

const Dashboard = () => {
    return (
        <div className="ml-64 pt-16 p-4 sm:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300"
            style={{ marginTop: '1cm' }}>
            <div className="max-w-7xl mx-auto">

                {/* Header Section */}
                <header className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8 transition-colors duration-300" style={{ backgroundColor: undefined }}>
                    <h1 className="text-xl sm:text-2xl font-semibold flex items-center" style={{ color: COLORS.primaryGreen }}>
                        <svg className="w-8 h-8 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: COLORS.primaryGreen }}>
                            <path d="M17 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"></path>
                            <path d="M17 9l-4-4"></path>
                            <path d="M17 9l4 4"></path>
                            <path d="M7 21h10"></path>
                            <path d="M12 21v-2c0-3.31-2.69-6-6-6H3"></path>
                        </svg>
                        Welcome, Admin!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">Monitor your plantations and analyze latest flight data.</p>
                </header>

                {/* Stats Cards Grid */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {STATS_DATA.map((stat, index) => (
                        <div
                            key={index}
                            className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 ${stat.color} transition duration-300 hover:shadow-xl`}
                        >
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{stat.title}</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                        </div>
                    ))}
                </section>

                {/* Main Content Grid */}
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Side: Map Overview */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-96 flex flex-col transition-colors duration-300">
                        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Farm Overview Map</h2>
                        <div className="flex-grow relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                            <p className="text-gray-400 text-lg">Map Placeholder</p>
                            <div className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full border-2 border-white shadow-xl cursor-pointer" style={{ backgroundColor: COLORS.primaryGreen }} title="Farm A - Healthy"></div>
                            <div className="absolute bottom-1/3 right-1/4 w-4 h-4 rounded-full border-2 border-white shadow-xl cursor-pointer" style={{ backgroundColor: COLORS.trendYellow }} title="Farm B - Warning"></div>
                            <div className="absolute bottom-1/4 left-1/2 w-4 h-4 rounded-full border-2 border-white shadow-xl cursor-pointer group" style={{ backgroundColor: COLORS.alertRed }}>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 text-white text-sm rounded-lg whitespace-nowrap shadow-xl opacity-100 transition-opacity" style={{ backgroundColor: COLORS.alertRed }}>
                                    Plot 3 (CRITICAL)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Latest Reports */}
                    <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg transition-colors duration-300">
                        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Latest Analysis Reports</h2>
                        <ul className="space-y-4">
                            {REPORTS_DATA.map((report, index) => (
                                <li key={index} className={`pb-4 ${index < REPORTS_DATA.length - 1 ? 'border-b' : ''}`}>
                                    <div className="flex items-start">
                                        <span className="inline-block mr-2 mt-1" style={{ color: report.color }}>
                                            <StatusCircle color={report.color} />
                                        </span>
                                        <div>
                                            <p className="font-medium text-gray-800 dark:text-gray-200">
                                                {report.farm}: <span className={report.className}>{report.issue}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{report.date}</p>
                                            <a href="#" className="text-sm font-medium flex items-center" style={{ color: COLORS.infoBlue }}>
                                                View Report
                                                <span className="ml-1 text-base">&rarr;</span>
                                            </a>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                </main>

            </div>
        </div>
    );
};

export default Dashboard;
