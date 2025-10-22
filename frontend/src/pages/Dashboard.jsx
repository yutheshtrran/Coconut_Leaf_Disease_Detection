import React, { useState } from 'react';
import { LayoutDashboard, FileText, Sprout, BellRing, Users, MapPin, BarChart3 } from '../components/Icons';

// =================================================================================
// 2. PAGE PLACEHOLDERS (To fulfill App.jsx imports)
// =================================================================================

const MyFarms = () => (
  <div className="p-8 text-gray-600">
    <h2 className="text-2xl font-bold">My Farms</h2>
    <p>Farm management page content (refer to previous response for full implementation).</p>
  </div>
);

const Reports = () => (
  <div className="p-8 text-gray-600">
    <h2 className="text-2xl font-bold">Reports</h2>
    <p>Generate and view detailed history reports on crop health and drone flights here.</p>
  </div>
);

const AlertSettings = () => (
  <div className="p-8 text-gray-600">
    <h2 className="text-2xl font-bold">Alert Settings</h2>
    <p>Configure thresholds for critical alerts (e.g., severe nutrient deficiency, pest detection).</p>
  </div>
);

const UserManagement = () => (
  <div className="p-8 text-gray-600">
    <h2 className="text-2xl font-bold">User Management</h2>
    <p>Manage user roles and permissions across the AgriMonitor platform.</p>
  </div>
);


// =================================================================================
// 3. SIDEBAR COMPONENT (Required by App.jsx)
// =================================================================================

const NavItem = ({ icon: Icon, label, screen, currentScreen, onNavigate }) => {
  const isActive = currentScreen === screen;
  const activeClasses = 'bg-green-100 text-green-700 font-semibold border-l-4 border-green-700';
  const inactiveClasses = 'text-gray-600 hover:bg-gray-100';

  return (
    <div
      className={`flex items-center space-x-3 p-3 rounded-r-full cursor-pointer transition-colors duration-150 ${isActive ? activeClasses : inactiveClasses}`}
      onClick={() => onNavigate(screen)}
    >
      <Icon className="w-5 h-5"/>
      <span>{label}</span>
    </div>
  );
};

export function Sidebar({ currentScreen, onNavigate }) {
  const navigation = [
    { label: 'Dashboard', screen: 'dashboard', icon: LayoutDashboard },
    { label: 'Reports', screen: 'reports', icon: FileText },
    { label: 'My Farms', screen: 'my-farms', icon: Sprout },
    { label: 'Alert Settings', screen: 'alert-settings', icon: BellRing },
    { label: 'User Management', screen: 'user-management', icon: Users },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-white shadow-xl flex flex-col justify-between h-full">
      {/* Top Section: Logo and Navigation */}
      <div>
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="text-2xl text-green-600">🌿</span> 
            <h1 className="text-xl font-bold text-gray-800 font-serif">AgriMonitor</h1>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="mt-6 space-y-1">
          {navigation.map((item) => (
            <NavItem 
              key={item.screen}
              icon={item.icon}
              label={item.label}
              screen={item.screen}
              currentScreen={currentScreen}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      {/* Bottom Section: User Profile */}
      <div className="p-6 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          {/* User Avatar */}
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            DA
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Dr. Argonahant</p>
            <p className="text-xs text-gray-500">Agronomist</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

// =================================================================================
// 4. DASHBOARD COMPONENT (Requested file: Dashboard.jsx)
// =================================================================================

const chartData = [
    { name: 'W1', value: 4000 },
    { name: 'W2', value: 3000 },
    { name: 'W3', value: 2000 },
    { name: 'W4', value: 2780 },
    { name: 'W5', value: 1890 },
    { name: 'W6', value: 2390 },
    { name: 'W7', value: 3490 },
];

const AlertBadge = ({ type, count }) => {
    const classes = {
        CRITICAL: 'bg-red-500 text-white',
        MODERATE: 'bg-yellow-400 text-gray-800',
        LOW: 'bg-green-500 text-white',
    };
    return (
        <div className={`p-4 rounded-xl shadow-md flex justify-between items-center ${classes[type]} transition duration-300 hover:shadow-lg`}>
            <p className="text-lg font-medium">{type} ALERTS</p>
            <span className="text-3xl font-bold">{count}</span>
        </div>
    );
};

const MetricCard = ({ title, value, unit, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color === 'green' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">
                {value}
                <span className="text-base font-normal text-gray-500 ml-1">{unit}</span>
            </p>
        </div>
    </div>
);


export function Dashboard() {
    // Max value in chartData is 4000, used for scaling the bars in the SVG
    const MAX_VALUE = 4000; 

  return (
    <div className="p-6 md:p-10 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 border-b pb-4 border-gray-200">System Overview</h1>

      {/* Alert Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <AlertBadge type="CRITICAL" count={2} />
          <AlertBadge type="MODERATE" count={15} />
          <AlertBadge type="LOW" count={88} />
      </div>

      {/* Key Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Farms Monitored" value="45" unit="Farms" icon={MapPin} color="green" />
        <MetricCard title="Total Area Analyzed" value="750" unit="Ha" icon={Sprout} color="blue" />
        <MetricCard title="Last Flight Activity" value="2" unit="Days Ago" icon={LayoutDashboard} color="green" />
        <MetricCard title="Active Users" value="12" unit="Users" icon={Users} color="blue" />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Activity Chart - Now using native SVG */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                <span>Weekly Detection Rate (Last 7 Weeks)</span>
            </h2>
            <div className="p-4">
                <svg viewBox="0 0 400 300" className="w-full h-auto max-h-80">
                    {/* Y-Axis Grid Lines */}
                    <line x1="40" y1="280" x2="380" y2="280" stroke="#e0e0e0" strokeWidth="1"/>
                    <line x1="40" y1="180" x2="380" y2="180" stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="5,5"/>
                    <line x1="40" y1="80" x2="380" y2="80" stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="5,5"/>
                    
                    {/* Y-Axis Labels (approximated) */}
                    <text x="30" y="285" fontSize="12" fill="#6b7280" textAnchor="end">0</text>
                    <text x="30" y="85" fontSize="12" fill="#6b7280" textAnchor="end">{MAX_VALUE}</text>
                    
                    {/* X-Axis Labels */}
                    {chartData.map((data, index) => (
                        <text key={data.name} x={65 + index * 50} y="295" fontSize="12" fill="#6b7280" textAnchor="middle">{data.name}</text>
                    ))}

                    {/* Bars (scaled height: value / MAX_VALUE * 200 (max bar height)) */}
                    {chartData.map((data, index) => {
                        const barHeight = (data.value / MAX_VALUE) * 200;
                        const yStart = 280 - barHeight;
                        const xStart = 55 + index * 50;

                        return (
                            <rect 
                                key={data.name}
                                x={xStart}
                                y={yStart}
                                width="20"
                                height={barHeight}
                                fill="#059669"
                                rx="3" 
                            />
                        );
                    })}
                </svg>
            </div>
            <p className="text-sm text-center text-gray-500 mt-2">Total detections of nutrient deficiencies and pests over time.</p>
        </div>

        {/* Recent Alerts */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md space-y-4">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Recent Critical Alerts</h2>
            <ul className="space-y-3">
                {[
                    { id: 1, type: 'CRITICAL', text: 'Farm A, Plot 3: Severe Potassium Deficiency' },
                    { id: 2, type: 'CRITICAL', text: 'Farm B: Potential Pest Infestation Detected' },
                    { id: 3, type: 'MODERATE', text: 'Farm C, Plot 1: Low Nitrogen Level' },
                ].map(alert => (
                    <li key={alert.id} className="p-3 border-l-4 border-red-500 bg-red-50 rounded-md text-sm">
                        <p className="font-semibold text-gray-800">{alert.type}</p>
                        <p className="text-gray-700">{alert.text}</p>
                    </li>
                ))}
            </ul>
            <button className="w-full text-center text-sm text-green-600 font-medium hover:text-green-800 transition">
                View All Alerts &rarr;
            </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================================
// 5. MAIN APPLICATION (Requested file: App.jsx)
// =================================================================================

export default function App() {
  // Define the possible screen names based on the navigation in Sidebar
  const [currentScreen, setCurrentScreen] = useState('dashboard'); 

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      
      {/* Main content area, uses overflow-y-auto to allow scrolling */}
      <main className="flex-1 overflow-y-auto">
        {/* Conditional Rendering */}
        {currentScreen === 'dashboard' && <Dashboard />}
        {currentScreen === 'reports' && <Reports />}
        {currentScreen === 'my-farms' && <MyFarms />}
        {currentScreen === 'alert-settings' && <AlertSettings />}
        {currentScreen === 'user-management' && <UserManagement />}
      </main>
    </div>
  )
}