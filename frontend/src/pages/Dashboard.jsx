import React from 'react';
import FarmMap from "./Farmmap.jsx";

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
        title: "Overall Health Trend",
        value: (
            <div className="flex items-center">
                <span className="mr-1">↑</span>
                <span className="text-xl text-green-500">Improving</span>
            </div>
        ),
        color: 'border-yellow-500'
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
    <svg className="w-3 h-3" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill={color} />
    </svg>
);

const Dashboard = () => {
    return (
        <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <header className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8">
                    <h1
                        className="text-xl sm:text-2xl font-semibold flex items-center"
                        style={{ color: COLORS.primaryGreen }}
                    >
                        <svg
                            className="w-8 h-8 mr-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M17 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                            <path d="M17 9l-4-4" />
                            <path d="M17 9l4 4" />
                            <path d="M7 21h10" />
                            <path d="M12 21v-2c0-3.31-2.69-6-6-6H3" />
                        </svg>
                        Welcome, Admin!
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Monitor your plantations and analyze latest flight data.
                    </p>
                </header>

                {/* Stats */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {STATS_DATA.map((stat, index) => (
                        <div
                            key={index}
                            className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 ${stat.color}`}
                        >
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {stat.title}
                            </p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </section>

                {/* Main Content */}
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* MAP CARD */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
                            Farm Overview Map
                        </h2>

                        {/* FIXED MAP CONTAINER */}
                        <div className="relative h-96 w-full overflow-hidden rounded-lg">
                            <FarmMap />
                        </div>
                    </div>

                    {/* REPORTS */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
                            Latest Analysis Reports
                        </h2>

                        <ul className="space-y-4">
                            {REPORTS_DATA.map((report, index) => (
                                <li
                                    key={index}
                                    className={`pb-4 ${index < REPORTS_DATA.length - 1 ? 'border-b' : ''}`}
                                >
                                    <div className="flex items-start">
                                        <span className="mr-2 mt-1">
                                            <StatusCircle color={report.color} />
                                        </span>

                                        <div>
                                            <p className="font-medium text-gray-800 dark:text-gray-200">
                                                {report.farm}:{' '}
                                                <span className={report.className}>
                                                    {report.issue}
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                {report.date}
                                            </p>
                                            <a
                                                href="#"
                                                className="text-sm font-medium flex items-center"
                                                style={{ color: COLORS.infoBlue }}
                                            >
                                                View Report →
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
