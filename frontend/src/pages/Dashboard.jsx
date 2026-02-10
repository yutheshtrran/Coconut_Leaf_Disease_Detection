import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import FarmMap from "./Farmmap.jsx";

// Define the custom colors
const COLORS = {
    primaryGreen: '#4CAF50',
    alertRed: '#F44336',
    infoBlue: '#2196F3',
    trendYellow: '#FFC107',
    bgHeader: '#E8F5E9',
};

// Placeholder data - will be replaced with real data
const STATS_DATA = [
    { title: "Total Farms Monitored", value: "0", color: 'border-green-500' },
    { title: "Critical Alerts", value: "0", color: 'border-red-500' },
    { title: "New Reports This Week", value: "0", color: 'border-blue-500' },
    {
        title: "Overall Health Trend",
        value: (
            <div className="flex items-center">
                <span className="mr-1">↑</span>
                <span className="text-xl text-green-500">Loading...</span>
            </div>
        ),
        color: 'border-yellow-500'
    },
];

// Helper function to get severity color and class
const getSeverityStyles = (label) => {
    switch (label) {
        case 'CRITICAL':
        case 'HIGH':
            return { color: COLORS.alertRed, className: 'text-red-600 font-semibold' };
        case 'MODERATE':
            return { color: COLORS.trendYellow, className: 'text-yellow-500' };
        case 'LOW':
        default:
            return { color: COLORS.primaryGreen, className: 'text-green-500' };
    }
};

// Status Circle component
const StatusCircle = ({ color }) => (
    <svg className="w-3 h-3" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill={color} />
    </svg>
);

import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [reportsError, setReportsError] = useState(null);
    
    // Stats state
    const [stats, setStats] = useState({
        totalFarms: 0,
        criticalAlerts: 0,
        reportsThisWeek: 0,
        healthTrend: 'Neutral',
        trendDirection: '→'
    });
    const [statsLoading, setStatsLoading] = useState(true);

    // Fetch latest reports from backend
    useEffect(() => {
        if (!user || authLoading) return;

        const fetchDashboardData = async () => {
            try {
                setStatsLoading(true);
                
                // Fetch all reports
                const reportsResponse = await API.get('/reports');
                const allReports = reportsResponse.data.data || [];

                // Calculate stats
                const totalFarms = new Set(allReports.map(r => r.farm)).size || 0;
                
                const criticalAlerts = allReports.filter(r => 
                    r.severity?.label === 'CRITICAL' || r.severity?.label === 'HIGH'
                ).length;

                // Get reports from this week
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                const reportsThisWeek = allReports.filter(r => 
                    new Date(r.createdAt) >= weekAgo
                ).length;

                // Calculate health trend
                const criticalCount = allReports.filter(r => r.severity?.label === 'CRITICAL').length;
                const highCount = allReports.filter(r => r.severity?.label === 'HIGH').length;
                const moderateCount = allReports.filter(r => r.severity?.label === 'MODERATE').length;
                const lowCount = allReports.filter(r => r.severity?.label === 'LOW').length;

                let healthTrend = 'Neutral';
                let trendDirection = '→';
                
                if (lowCount + moderateCount > criticalCount + highCount) {
                    healthTrend = 'Improving';
                    trendDirection = '↑';
                } else if (criticalCount + highCount > lowCount + moderateCount) {
                    healthTrend = 'Declining';
                    trendDirection = '↓';
                }

                setStats({
                    totalFarms,
                    criticalAlerts,
                    reportsThisWeek,
                    healthTrend,
                    trendDirection
                });
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, authLoading]);

    // Fetch latest reports from backend
    useEffect(() => {
        if (!user || authLoading) return;

        const fetchLatestReports = async () => {
            try {
                setReportsLoading(true);
                setReportsError(null);
                const response = await API.get('/reports');
                
                // Get the latest 3 reports
                const latestReports = response.data.data
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 3)
                    .map(report => {
                        const severityStyles = getSeverityStyles(report.severity.label);
                        return {
                            farm: report.farm,
                            issue: report.issue,
                            date: new Date(report.date).toISOString().split('T')[0],
                            color: severityStyles.color,
                            className: severityStyles.className,
                            severity: report.severity.label
                        };
                    });

                setReports(latestReports);
            } catch (err) {
                console.error('Error fetching reports:', err);
                if (err.response?.status !== 401) {
                    setReportsError('Failed to fetch latest reports');
                }
                setReports([]);
            } finally {
                setReportsLoading(false);
            }
        };

        fetchLatestReports();
    }, [user, authLoading]);
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
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 border-green-500">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Total Farms Monitored
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {statsLoading ? '...' : stats.totalFarms}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 border-red-500">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Critical Alerts
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {statsLoading ? '...' : stats.criticalAlerts}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 border-blue-500">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            New Reports This Week
                        </p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {statsLoading ? '...' : stats.reportsThisWeek}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg border-b-4 border-yellow-500">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Overall Health Trend
                        </p>
                        <div className="flex items-center">
                            <span className="mr-1 text-2xl">{statsLoading ? '...' : stats.trendDirection}</span>
                            <span className={`text-xl font-semibold ${
                                stats.healthTrend === 'Improving' ? 'text-green-500' :
                                stats.healthTrend === 'Declining' ? 'text-red-500' :
                                'text-yellow-500'
                            }`}>
                                {statsLoading ? 'Loading...' : stats.healthTrend}
                            </span>
                        </div>
                    </div>
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

                        {reportsError && (
                            <p className="text-red-500 text-sm mb-4">{reportsError}</p>
                        )}

                        {reportsLoading ? (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading reports...</p>
                        ) : reports.length > 0 ? (
                            <ul className="space-y-4">
                                {reports.map((report, index) => (
                                    <li
                                        key={index}
                                        className={`pb-4 ${index < reports.length - 1 ? 'border-b' : ''}`}
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
                                                    href="/reports"
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
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">No reports available. Create one to get started!</p>
                        )}
                    </div>

                </main>
            </div>
        </div>
    );
};

export default Dashboard;
