import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import { getUserFarms } from '../services/farmService';
import FarmMap from './Farmmap.jsx';
import { Loader2, AlertTriangle, BarChart2, TrendingUp, TrendingDown, Minus, Leaf, FileText, MapPin } from 'lucide-react';

const severityColor = (label) => {
    switch (label) {
        case 'CRITICAL': return { dot: '#EF4444', text: 'text-red-600 font-semibold' };
        case 'HIGH':     return { dot: '#F97316', text: 'text-orange-500 font-semibold' };
        case 'MODERATE': return { dot: '#EAB308', text: 'text-yellow-500' };
        default:         return { dot: '#22C55E', text: 'text-green-500' };
    }
};

const StatCard = ({ icon, label, value, sub, borderColor, loading }) => (
    <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border-b-4 ${borderColor} flex flex-col gap-1`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            {icon}
            {label}
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {loading ? <Loader2 size={24} className="animate-spin text-gray-400" /> : value}
        </p>
        {sub && !loading && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading]   = useState(true);
    const [error,   setError]     = useState(null);

    // Derived data
    const [farms,   setFarms]   = useState([]);
    const [reports, setReports] = useState([]);   // user's own reports

    // Computed stats
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!user || authLoading) return;
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                const [farmsRes, reportsRes] = await Promise.all([
                    getUserFarms(),
                    API.get('/reports'),
                ]);

                if (cancelled) return;

                const allFarms = farmsRes.farms || [];

                // Filter reports that belong to this user
                const userId = user._id?.toString();
                const allReports = (reportsRes.data.data || []).filter(r => {
                    const rid = r.userId?._id?.toString() || r.userId?.toString();
                    return rid === userId;
                });

                // Sort newest-first for the recent list
                const sorted = [...allReports].sort(
                    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                );

                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                const scansThisWeek = allReports.filter(r => new Date(r.createdAt) >= weekAgo).length;
                const criticalCount = allReports.filter(r => ['CRITICAL', 'HIGH'].includes(r.severity?.label)).length;

                // Aggregate tree data from analysisData
                let totalTrees = 0, atRiskTrees = 0;
                allReports.forEach(r => {
                    const ts = r.analysisData?.treeSummary;
                    if (ts) {
                        totalTrees  += ts.total  || 0;
                        atRiskTrees += ts.atRisk || 0;
                    }
                });

                // Health trend: ratio of healthy vs at-risk across all reports
                const lowCount  = allReports.filter(r => ['LOW',  'MODERATE'].includes(r.severity?.label)).length;
                const highCount = allReports.filter(r => ['HIGH', 'CRITICAL'].includes(r.severity?.label)).length;
                let trend = 'Neutral', trendDir = 'neutral';
                if (lowCount > highCount)  { trend = 'Improving'; trendDir = 'up'; }
                if (highCount > lowCount)  { trend = 'Declining'; trendDir = 'down'; }

                // Top diseases across all reports
                const diseaseMap = {};
                allReports.forEach(r => {
                    (r.analysisData?.diseases || []).forEach(d => {
                        diseaseMap[d.name] = (diseaseMap[d.name] || 0) + d.count;
                    });
                });
                const topDiseases = Object.entries(diseaseMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                setFarms(allFarms);
                setReports(sorted);
                setStats({
                    totalFarms: allFarms.length,
                    totalReports: allReports.length,
                    scansThisWeek,
                    criticalCount,
                    totalTrees,
                    atRiskTrees,
                    healthyTrees: totalTrees - atRiskTrees,
                    trend,
                    trendDir,
                    topDiseases,
                });
            } catch (err) {
                if (!cancelled) {
                    console.error('Dashboard load error:', err);
                    setError('Failed to load dashboard data.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [user, authLoading]);

    const greeting = user?.username || user?.name || user?.email?.split('@')[0] || 'there';

    const TrendIcon = stats?.trendDir === 'up'
        ? <TrendingUp size={22} className="text-green-500" />
        : stats?.trendDir === 'down'
            ? <TrendingDown size={22} className="text-red-500" />
            : <Minus size={22} className="text-yellow-500" />;

    const trendColor = stats?.trend === 'Improving' ? 'text-green-500'
        : stats?.trend === 'Declining' ? 'text-red-500'
        : 'text-yellow-500';

    return (
        <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <header className="bg-white dark:bg-gray-800 px-6 py-5 rounded-xl shadow-md flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                        <Leaf size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-green-600 dark:text-green-400">
                            Welcome back, {greeting}!
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Monitor your plantations and analyse the latest flight data.
                        </p>
                    </div>
                </header>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 rounded-xl px-5 py-3 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {/* Primary stat cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<MapPin size={14} />}
                        label="My Farms"
                        value={stats?.totalFarms ?? 0}
                        sub={stats?.totalFarms === 1 ? '1 farm registered' : `${stats?.totalFarms ?? 0} farms registered`}
                        borderColor="border-green-500"
                        loading={loading}
                    />
                    <StatCard
                        icon={<AlertTriangle size={14} />}
                        label="Active Alerts"
                        value={stats?.criticalCount ?? 0}
                        sub="Critical or High severity"
                        borderColor="border-red-500"
                        loading={loading}
                    />
                    <StatCard
                        icon={<FileText size={14} />}
                        label="Scans This Week"
                        value={stats?.scansThisWeek ?? 0}
                        sub={`${stats?.totalReports ?? 0} total reports`}
                        borderColor="border-blue-500"
                        loading={loading}
                    />
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md border-b-4 border-yellow-500 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                            {loading ? <Loader2 size={14} className="animate-spin" /> : TrendIcon}
                            Health Trend
                        </div>
                        <p className={`text-2xl font-bold ${loading ? 'text-gray-300' : trendColor}`}>
                            {loading ? <Loader2 size={24} className="animate-spin text-gray-400" /> : stats?.trend}
                        </p>
                        {!loading && stats && (
                            <p className="text-xs text-gray-400">
                                Based on {stats.totalReports} report{stats.totalReports !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                </section>

                {/* Secondary stat cards — tree data */}
                {!loading && stats && stats.totalTrees > 0 && (
                    <section className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Trees Analysed</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalTrees.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">At Risk</p>
                            <p className="text-2xl font-bold text-red-500">{stats.atRiskTrees.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Healthy</p>
                            <p className="text-2xl font-bold text-green-500">{stats.healthyTrees.toLocaleString()}</p>
                        </div>
                    </section>
                )}

                {/* Main content: map + reports */}
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Map */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <MapPin size={18} className="text-green-500" /> Farm Overview Map
                        </h2>
                        <div className="relative h-96 w-full overflow-hidden rounded-lg isolate">
                            <FarmMap />
                        </div>
                    </div>

                    {/* Recent reports */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-blue-500" /> Latest Reports
                        </h2>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 size={32} className="animate-spin text-green-600" />
                            </div>
                        ) : reports.length === 0 ? (
                            <p className="text-gray-400 dark:text-gray-500 text-sm flex-1 flex items-center justify-center text-center">
                                No reports yet.<br />Run an analysis to get started.
                            </p>
                        ) : (
                            <ul className="space-y-4 flex-1">
                                {reports.slice(0, 4).map((report, i) => {
                                    const { dot, text } = severityColor(report.severity?.label);
                                    return (
                                        <li key={report._id || i} className={`pb-4 ${i < Math.min(reports.length, 4) - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                                            <div className="flex items-start gap-2">
                                                <svg className="w-3 h-3 mt-1.5 shrink-0" viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="50" fill={dot} />
                                                </svg>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">
                                                        {report.farm}
                                                    </p>
                                                    <p className={`text-xs ${text} truncate`}>{report.issue}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {!loading && reports.length > 0 && (
                            <button
                                onClick={() => navigate('/reports')}
                                className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline text-right"
                            >
                                View all reports →
                            </button>
                        )}
                    </div>
                </main>

                {/* Top diseases breakdown */}
                {!loading && stats?.topDiseases?.length > 0 && (
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <BarChart2 size={18} className="text-red-500" /> Most Detected Diseases
                        </h2>
                        <div className="space-y-3">
                            {stats.topDiseases.map(([name, count], i) => {
                                const maxCount = stats.topDiseases[0][1];
                                const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600 dark:text-gray-300 w-44 truncate shrink-0">{name}</span>
                                        <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-red-400"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-10 text-right shrink-0">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
};

export default Dashboard;
