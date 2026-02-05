import React, { useState, useMemo } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';

// --- Mock Data ---
const initialFarms = [
  { id: 'A', name: 'Farm A', subtitle: 'Green Valley', location: '7.29° N, 80.64° E', area: '15 Ha', admin: 'Admin' },
  { id: 'B', name: 'Farm B', subtitle: 'Coconut Hills', location: '5.20° N, 80.40° E', area: '22 Ha', admin: 'Admin' },
  { id: 'C', name: 'Farm C', subtitle: 'Palm Estates', location: '6.50° N, 80.90° E', area: '10 Ha', admin: 'Admin' },
  { id: 'D', name: 'Farm D', subtitle: 'Tropical Gardens', location: '7.80° N, 80.10° E', area: '30 Ha', admin: 'Admin' },
];

const currentYear = new Date().getFullYear();
const initialPlots = [
  { id: 1, farmId: 'A', area: 2.5, lastAnalyzed: `${currentYear}-10-26`, status: 'LOW_RISK' },
  { id: 2, farmId: 'A', area: 3.2, lastAnalyzed: `${currentYear}-10-25`, status: 'LOW_RISK' },
  { id: 3, farmId: 'A', area: 1.8, lastAnalyzed: `${currentYear}-10-26`, status: 'CRITICAL' },
  { id: 4, farmId: 'A', area: 4.0, lastAnalyzed: `${currentYear}-10-24`, status: 'MODERATE' },
  { id: 5, farmId: 'B', area: 5.0, lastAnalyzed: `${currentYear}-10-20`, status: 'LOW_RISK' },
];

// --- Utility ---
const getStatusBadge = (status) => {
  let colorClass = '', text = '';
  switch (status) {
    case 'LOW_RISK':
      colorClass = 'bg-green-100 text-green-700 ring-green-600/20';
      text = 'LOW RISK';
      break;
    case 'CRITICAL':
      colorClass = 'bg-red-100 text-red-700 ring-red-600/20';
      text = 'CRITICAL';
      break;
    case 'MODERATE':
      colorClass = 'bg-yellow-100 text-yellow-700 ring-yellow-600/20';
      text = 'MODERATE';
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-700 ring-gray-600/20';
      text = 'UNKNOWN';
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${colorClass}`}>
      {text}
    </span>
  );
};

// --- Components ---
const FarmDetailsCard = ({ farm, onEdit }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-colors duration-300">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{farm.name}</h2>
      <button onClick={onEdit} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-600 transition">
        <Pencil className="w-4 h-4" /> Edit Details
      </button>
    </div>
    <p className="text-sm text-gray-500 mb-6">{farm.admin}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase">Location</p>
          <p className="text-lg font-mono text-gray-700">{farm.location}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase">Total Area</p>
          <p className="text-lg font-semibold text-gray-700">{farm.area}</p>
        </div>
      </div>
      <div className="bg-gray-200 h-full min-h-[150px] rounded-lg flex items-center justify-center text-gray-500 font-medium tracking-wider shadow-inner border border-gray-300">
        Map Preview
      </div>
    </div>
  </div>
);

const PlotsTable = ({ farm, plots }) => {
  const farmPlots = useMemo(() => plots.filter(p => p.farmId === farm.id), [farm.id, plots]);
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Plots in {farm.name}</h3>
      <div className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Plot ID', 'Area (ha)', 'Last Analyzed', 'Status', 'Actions'].map((header, idx) => (
                <th key={idx} className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${idx === 0 ? 'rounded-tl-xl' : ''} ${idx === 4 ? 'rounded-tr-xl' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {farmPlots.map(plot => (
              <tr key={plot.id} className="hover:bg-gray-50 transition duration-150">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Plot {plot.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{plot.area}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{plot.lastAnalyzed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(plot.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 transition font-medium">
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Component ---
const MyFarms = () => {
  const [selectedFarmId, setSelectedFarmId] = useState('A');
  const [farms, setFarms] = useState(initialFarms);
  const [plots] = useState(initialPlots);
  const [search, setSearch] = useState('');

  const filteredFarms = useMemo(() =>
    farms.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [search, farms]
  );

  const selectedFarm = useMemo(() => farms.find(f => f.id === selectedFarmId), [farms, selectedFarmId]);

  const handleSelectFarm = (id) => setSelectedFarmId(id);
  const handleAddFarm = () => alert('Action: Add New Farm');
  const handleEditDetails = () => alert(`Action: Edit Details for ${selectedFarm.name}`);

  return (
    <div className="flex bg-gray-100 dark:bg-gray-900 transition-colors duration-300 pt-4 min-h-screen">
      {/* Sidebar for farms list */}
      <aside
        className="w-72 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 p-6 overflow-y-auto h-screen sticky top-0 transition-colors duration-300"
      >
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a farm..."
            className="w-full py-2 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <nav className="space-y-2">
          {filteredFarms.map(farm => (
            <div
              key={farm.id}
              onClick={() => handleSelectFarm(farm.id)}
              className={`p-3 rounded-xl cursor-pointer transition duration-150 ${farm.id === selectedFarmId ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-l-4 border-green-500 shadow-inner' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              <p className="font-semibold">{farm.name}</p>
              <p className="text-xs">{farm.subtitle}</p>
            </div>
          ))}
        </nav>
        {filteredFarms.length === 0 && <p className="text-sm text-gray-400 mt-2">No farms found.</p>}
      </aside>

      {/* Main Content stays in place */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-y-auto transition-colors duration-300">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Farm & Plot Management</h1>
          <button onClick={handleAddFarm} className="inline-flex items-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-700 transition duration-200">
            <Plus className="w-5 h-5 mr-1" /> Add New Farm
          </button>
        </header>

        {selectedFarm ? (
          <div className="space-y-8">
            <FarmDetailsCard farm={selectedFarm} onEdit={handleEditDetails} />
            <PlotsTable farm={selectedFarm} plots={plots} />
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">Please select a farm from the left to view its details.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyFarms;
