import React, { useState, useMemo } from 'react';
import { Search, Plus, Pencil, X, Check, Map, Calendar, AlertCircle } from 'lucide-react';

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

// --- Form Components ---
const AddFarmForm = ({ onAdd, onCancel }) => {
  const [formData, setFormData] = useState({ name: '', subtitle: '', location: '', area: '', admin: 'Admin' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.area) return;
    onAdd({ ...formData, id: Math.random().toString(36).substr(2, 9) });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Add New Farm</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Farm Name</label>
          <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Subtitle/Region</label>
          <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Location (Lat/Long)</label>
          <input placeholder="0.00° N, 0.00° E" type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Total Area (Ha)</label>
          <input required type="text" placeholder="e.g. 25 Ha" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex gap-3 pt-4 border-t">
          <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"><Check size={18} /> Save Farm</button>
          <button type="button" onClick={onCancel} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
        </div>
      </form>
    </div>
  );
};

const AddPlotForm = ({ farmId, onAdd, onCancel }) => {
  const [formData, setFormData] = useState({ area: '', status: 'LOW_RISK', lastAnalyzed: new Date().toISOString().split('T')[0] });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.area) return;
    onAdd({ ...formData, farmId, id: Math.floor(Math.random() * 10000) });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-green-600" /> New Plot Assessment</h3>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Area (ha)</label>
          <input required step="0.1" type="number" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
          <select className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
            <option value="LOW_RISK">LOW RISK</option>
            <option value="MODERATE">MODERATE</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex-1">Add Plot</button>
          <button type="button" onClick={onCancel} className="bg-gray-100 p-2 rounded-lg text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
      </form>
    </div>
  );
};

// --- Main Components ---
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
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Location</p>
          <p className="text-lg font-mono text-gray-700">{farm.location || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Area</p>
          <p className="text-lg font-semibold text-gray-700">{farm.area}</p>
        </div>
      </div>
      <div className="bg-gray-200 h-full min-h-[150px] rounded-lg flex flex-col items-center justify-center text-gray-400 font-medium tracking-wider shadow-inner border border-gray-300">
        <Map size={32} className="mb-2 opacity-50" />
        Map Preview
      </div>
    </div>
  </div>
);

const PlotsTable = ({ farm, plots, onAddPlotRequest }) => {
  const farmPlots = useMemo(() => plots.filter(p => p.farmId === farm.id), [farm.id, plots]);
  return (
    <div className="mt-8">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Plots in {farm.name}</h3>
        <button
          onClick={onAddPlotRequest}
          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
        >
          <Plus size={14} /> Add Plot
        </button>
      </div>
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
                  <button className="text-indigo-600 hover:text-indigo-900 p-2"><Pencil className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Application ---
const MyFarms = () => {
  const [selectedFarmId, setSelectedFarmId] = useState('A');
  const [farms, setFarms] = useState(initialFarms);
  const [plots, setPlots] = useState(initialPlots);
  const [search, setSearch] = useState('');

  // View states
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [showPlotForm, setShowPlotForm] = useState(false);

  const filteredFarms = useMemo(() =>
    farms.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [search, farms]
  );

  const selectedFarm = useMemo(() => farms.find(f => f.id === selectedFarmId), [farms, selectedFarmId]);

  const handleSelectFarm = (id) => {
    setSelectedFarmId(id);
    setShowFarmForm(false);
    setShowPlotForm(false);
  };

  const handleAddFarm = (newFarm) => {
    setFarms([...farms, newFarm]);
    setSelectedFarmId(newFarm.id);
    setShowFarmForm(false);
  };

  const handleAddPlot = (newPlot) => {
    setPlots([...plots, newPlot]);
    setShowPlotForm(false);
  };

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
              <p className="text-xs opacity-70">{farm.subtitle}</p>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content stays in place */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-y-auto transition-colors duration-300">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Farm & Plot Management</h1>
          {!showFarmForm && (
            <button onClick={() => setShowFarmForm(true)} className="inline-flex items-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-700 transition duration-200">
              <Plus className="w-5 h-5 mr-1" /> Add New Farm
            </button>
          )}
        </header>

        {showFarmForm ? (
          <AddFarmForm onAdd={handleAddFarm} onCancel={() => setShowFarmForm(false)} />
        ) : selectedFarm ? (
          <div className="space-y-8 max-w-5xl">
            <FarmDetailsCard farm={selectedFarm} onEdit={() => alert('Edit triggered')} />

            {showPlotForm ? (
              <AddPlotForm
                farmId={selectedFarm.id}
                onAdd={handleAddPlot}
                onCancel={() => setShowPlotForm(false)}
              />
            ) : (
              <PlotsTable
                farm={selectedFarm}
                plots={plots}
                onAddPlotRequest={() => setShowPlotForm(true)}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">Select a farm from the sidebar to view details</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyFarms;