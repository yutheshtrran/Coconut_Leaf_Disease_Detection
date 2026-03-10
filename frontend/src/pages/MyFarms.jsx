import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Pencil, X, Check, Map, Calendar, AlertCircle, Loader, Trash } from 'lucide-react';
import * as farmService from '../services/farmService';

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
const AddFarmForm = ({ onAdd, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({ name: '', subtitle: '', location: '', area: '', description: '' });
  const [error, setError] = useState('');
  const [locMode, setLocMode] = useState('manual'); // 'manual' | 'current' | 'map'
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const mapRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.area) {
      setError('Farm name and area are required');
      return;
    }

    try {
      setError('');
      // prefer the explicit lat/lng if provided
      const finalData = { ...formData };
      if ((locMode === 'manual' || locMode === 'current' || locMode === 'map') && lat && lng) {
        finalData.location = `${lat}, ${lng}`;
      }
      await onAdd(finalData);
      setFormData({ name: '', subtitle: '', location: '', area: '', description: '' });
      setLat('');
      setLng('');
      setLocMode('manual');
    } catch (err) {
      setError(err.message || 'Failed to add farm');
    }
  };

  // Load Leaflet dynamically when map mode is selected
  useEffect(() => {
    let mapInstance;
    const loadLeaflet = () => new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      const jsSrc = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      if (!document.querySelector(`link[href="${cssHref}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssHref;
        document.head.appendChild(link);
      }
      if (document.querySelector(`script[src="${jsSrc}"]`)) {
        const existing = document.querySelector(`script[src="${jsSrc}"]`);
        existing.addEventListener('load', () => resolve(window.L));
        existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
        return;
      }
      const script = document.createElement('script');
      script.src = jsSrc;
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.body.appendChild(script);
    });

    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (!document.getElementById('add-farm-map')) return;
        mapInstance = L.map('add-farm-map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);
        let marker = null;
        mapInstance.on('click', (e) => {
          const { lat: clickedLat, lng: clickedLng } = e.latlng;
          setLat(String(clickedLat));
          setLng(String(clickedLng));
          if (marker) marker.setLatLng(e.latlng);
          else marker = L.marker(e.latlng).addTo(mapInstance);
        });
        mapRef.current = { instance: mapInstance, markerRef: () => marker };
      } catch (err) {
        console.error('Leaflet load failed', err);
        setError('Map failed to load');
      }
    };

    if (locMode === 'map') {
      initMap();
    }

    return () => {
      try {
        if (mapInstance && mapInstance.remove) mapInstance.remove();
      } catch (e) { }
    };
  }, [locMode]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Add New Farm</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Farm Name</label>
          <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Subtitle/Region</label>
          <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Location (Lat/Long)</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setLocMode('manual')} className={`px-3 py-1 rounded-lg text-sm ${locMode === 'manual' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Manual</button>
            <button type="button" onClick={() => setLocMode('current')} className={`px-3 py-1 rounded-lg text-sm ${locMode === 'current' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Use Current</button>
            <button type="button" onClick={() => setLocMode('map')} className={`px-3 py-1 rounded-lg text-sm ${locMode === 'map' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Select on Map</button>
          </div>

          {locMode === 'manual' && (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Latitude" type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={lat} onChange={e => setLat(e.target.value)} disabled={isLoading} />
              <input placeholder="Longitude" type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={lng} onChange={e => setLng(e.target.value)} disabled={isLoading} />
            </div>
          )}

          {locMode === 'current' && (
            <div className="flex gap-2 items-center">
              <button type="button" onClick={async () => {
                if (!navigator.geolocation) {
                  setError('Geolocation is not supported by your browser');
                  return;
                }
                setError('');
                navigator.geolocation.getCurrentPosition((position) => {
                  const { latitude, longitude } = position.coords;
                  setLat(String(latitude));
                  setLng(String(longitude));
                }, (err) => {
                  setError('Unable to retrieve your location');
                });
              }} className="bg-indigo-600 text-white px-3 py-2 rounded-lg">Get Current Location</button>
              <div className="text-sm text-gray-600">{lat && lng ? `Lat: ${lat}, Lng: ${lng}` : 'No location yet'}</div>
            </div>
          )}

          {locMode === 'map' && (
            <div>
              <div id="add-farm-map" style={{ height: 220 }} className="w-full rounded-lg overflow-hidden border" />
              <div className="text-sm text-gray-600 mt-2">Click on the map to place a marker and select coordinates. {lat && lng ? `Selected: ${lat}, ${lng}` : ''}</div>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Total Area (Ha)</label>
          <input required type="text" placeholder="e.g. 25 Ha" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} disabled={isLoading} />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Description</label>
          <textarea className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} disabled={isLoading} rows="3" />
        </div>
        <div className="md:col-span-2 flex gap-3 pt-4 border-t">
          <button type="submit" disabled={isLoading} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
            {isLoading ? 'Saving...' : 'Save Farm'}
          </button>
          <button type="button" onClick={onCancel} disabled={isLoading} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
        </div>
      </form>
    </div>
  );
};

const EditFarmForm = ({ farm, onUpdate, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: farm.name || '',
    subtitle: farm.subtitle || '',
    location: farm.location || '',
    area: farm.area || '',
    description: farm.description || '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.area) {
      setError('Farm name and area are required');
      return;
    }

    try {
      setError('');
      await onUpdate(farm._id, formData);
    } catch (err) {
      setError(err.message || 'Failed to update farm');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Edit Farm Details</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Farm Name</label>
          <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Subtitle/Region</label>
          <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Location (Lat/Long)</label>
          <input placeholder="0.00° N, 0.00° E" type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Total Area (Ha)</label>
          <input required type="text" placeholder="e.g. 25 Ha" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} disabled={isLoading} />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Description</label>
          <textarea className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} disabled={isLoading} rows="3" />
        </div>
        <div className="md:col-span-2 flex gap-3 pt-4 border-t">
          <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
            {isLoading ? 'Updating...' : 'Update Farm'}
          </button>
          <button type="button" onClick={onCancel} disabled={isLoading} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
        </div>
      </form>
    </div>
  );
};

const AddPlotForm = ({ farmId, onAdd, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({ name: '', area: '', status: 'LOW_RISK' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.area) {
      setError('Plot name and area are required');
      return;
    }

    try {
      setError('');
      await onAdd(formData);
      setFormData({ name: '', area: '', status: 'LOW_RISK' });
    } catch (err) {
      setError(err.message || 'Failed to add plot');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Plus size={18} className="text-green-600" /> New Plot Assessment</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Plot Name</label>
          <input required type="text" placeholder="e.g., A1, North Section" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Area (ha)</label>
          <input required step="0.1" type="number" placeholder="0.0" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
          <select className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} disabled={isLoading}>
            <option value="LOW_RISK">LOW RISK</option>
            <option value="MODERATE">MODERATE</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            {isLoading ? 'Saving...' : 'Add Plot'}
          </button>
          <button type="button" onClick={onCancel} disabled={isLoading} className="bg-gray-100 p-2 rounded-lg text-gray-500 hover:text-gray-700 disabled:opacity-50"><X size={20} /></button>
        </div>
      </form>
    </div>
  );
};

const EditPlotForm = ({ farmId, plot, onUpdate, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({ name: plot.name || '', area: plot.area || '', status: plot.status || 'LOW_RISK' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.area) {
      setError('Plot name and area are required');
      return;
    }
    try {
      setError('');
      await onUpdate(plot._id, formData);
    } catch (err) {
      setError(err.message || 'Failed to update plot');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Pencil size={18} className="text-indigo-600" /> Edit Plot</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Plot Name</label>
          <input required type="text" placeholder="e.g., A1, North Section" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Area (ha)</label>
          <input required step="0.1" type="number" placeholder="0.0" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
          <select className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} disabled={isLoading}>
            <option value="LOW_RISK">LOW RISK</option>
            <option value="MODERATE">MODERATE</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onCancel} disabled={isLoading} className="bg-gray-100 p-2 rounded-lg text-gray-500 hover:text-gray-700 disabled:opacity-50"><X size={20} /></button>
        </div>
      </form>
    </div>
  );
};

// --- Main Components ---
const FarmDetailsCard = ({ farm, onEdit }) => {
  const adminName = farm.admin?.username || farm.admin || 'Unknown';
  const mapContainerId = `farm-map-${farm._id}`;
  const mapRef = useRef(null);

  useEffect(() => {
    let mapInstance;
    const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const jsSrc = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

    const loadLeaflet = () => new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      if (!document.querySelector(`link[href="${cssHref}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssHref;
        document.head.appendChild(link);
      }
      if (document.querySelector(`script[src="${jsSrc}"]`)) {
        const existing = document.querySelector(`script[src="${jsSrc}"]`);
        existing.addEventListener('load', () => resolve(window.L));
        existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
        return;
      }
      const script = document.createElement('script');
      script.src = jsSrc;
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.body.appendChild(script);
    });

    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        const loc = (farm.location || '').trim();
        if (!loc) return;
        const parts = loc.split(',').map(s => s.trim());
        if (parts.length < 2) return;
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        if (!document.getElementById(mapContainerId)) return;
        mapInstance = L.map(mapContainerId, { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(mapInstance);
        L.marker([lat, lng]).addTo(mapInstance);
        mapRef.current = mapInstance;
      } catch (err) {
        console.error('Farm map init failed', err);
      }
    };

    initMap();

    return () => {
      try {
        if (mapInstance && mapInstance.remove) mapInstance.remove();
      } catch (e) { }
    };
  }, [farm.location, mapContainerId]);

  const hasCoords = !!farm.location && farm.location.split(',').length >= 2;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-colors duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{farm.name}</h2>
        <button onClick={() => onEdit(farm)} className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-600 transition">
          <Pencil className="w-4 h-4" /> Edit Details
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">Managed by: {adminName}</p>
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
          {farm.description && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</p>
              <p className="text-sm text-gray-600">{farm.description}</p>
            </div>
          )}
        </div>
        <div className="h-full min-h-[150px] rounded-lg overflow-hidden border">
          {hasCoords ? (
            <div id={mapContainerId} style={{ height: 220 }} className="w-full" />
          ) : (
            <div className="bg-gray-200 h-full min-h-[150px] rounded-lg flex flex-col items-center justify-center text-gray-400 font-medium tracking-wider shadow-inner border border-gray-300">
              <Map size={32} className="mb-2 opacity-50" />
              Map Preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlotsTable = ({ farm, plots, onAddPlotRequest, onDeletePlot, onEditPlot }) => {
  const farmPlots = useMemo(() => plots[farm._id] || [], [farm._id, plots]);
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
              {['Plot Name', 'Area (ha)', 'Last Analyzed', 'Status', 'Actions'].map((header, idx) => (
                <th key={idx} className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${idx === 0 ? 'rounded-tl-xl' : ''} ${idx === 4 ? 'rounded-tr-xl' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {farmPlots.length > 0 ? (
              farmPlots.map(plot => (
                <tr key={plot._id} className="hover:bg-gray-50 transition duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plot.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{plot.area}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{plot.lastAnalyzed || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(plot.status || 'LOW_RISK')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onEditPlot && onEditPlot(plot); }} className="text-indigo-600 hover:text-indigo-900 p-2"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDeletePlot && onDeletePlot(plot._id); }} className="text-red-600 hover:text-red-900 p-2"><Trash className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No plots yet. Click "Add Plot" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Application ---
const MyFarms = () => {
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [farms, setFarms] = useState([]);
  const [plots, setPlots] = useState({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // View states
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [showPlotForm, setShowPlotForm] = useState(false);
  const [editingFarm, setEditingFarm] = useState(null);
  const [editingPlot, setEditingPlot] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmData, setConfirmData] = useState({ type: null, farmId: null, plotId: null, name: '' });

  // Load farms on component mount
  useEffect(() => {
    const loadFarms = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await farmService.getUserFarms();
        setFarms(response.farms || []);

        // Load plots for all farms
        const plotsData = {};
        for (const farm of (response.farms || [])) {
          try {
            const plotsResponse = await farmService.getFarmPlots(farm._id);
            plotsData[farm._id] = plotsResponse.plots || [];
          } catch (err) {
            console.error(`Error loading plots for farm ${farm._id}:`, err);
            plotsData[farm._id] = [];
          }
        }
        setPlots(plotsData);

        // Auto-select first farm if available
        if (response.farms && response.farms.length > 0) {
          setSelectedFarmId(response.farms[0]._id);
        }
      } catch (err) {
        console.error('Error loading farms:', err);
        setError('Failed to load farms. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFarms();
  }, []);

  const filteredFarms = useMemo(() =>
    farms.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [search, farms]
  );

  const selectedFarm = useMemo(() => farms.find(f => f._id === selectedFarmId), [farms, selectedFarmId]);

  const handleSelectFarm = (id) => {
    setSelectedFarmId(id);
    setShowFarmForm(false);
    setShowPlotForm(false);
    setEditingFarm(null);
  };

  const handleAddFarm = async (formData) => {
    try {
      setIsSaving(true);
      setError('');
      const response = await farmService.addFarm(formData);
      setFarms([...farms, response.farm]);
      // Initialize empty plots array for new farm
      setPlots({ ...plots, [response.farm._id]: [] });
      // notify other components (e.g., dashboard map) about the new farm
      try {
        window.dispatchEvent(new CustomEvent('farmsUpdated', { detail: response.farm }));
      } catch (e) {
        // ignore in non-browser envs
      }
      setSelectedFarmId(response.farm._id);
      setShowFarmForm(false);
    } catch (err) {
      console.error('Error adding farm:', err);
      throw new Error(err.response?.data?.message || 'Failed to add farm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditFarm = async (farmId, formData) => {
    try {
      setIsSaving(true);
      setError('');
      const response = await farmService.updateFarm(farmId, formData);
      // Update the farms list with the updated farm
      setFarms(farms.map(f => f._id === farmId ? response.farm : f));
      setEditingFarm(null);
    } catch (err) {
      console.error('Error updating farm:', err);
      throw new Error(err.response?.data?.message || 'Failed to update farm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPlot = async (formData) => {
    if (!selectedFarmId) return;
    try {
      setIsSaving(true);
      setError('');
      const response = await farmService.addPlot(selectedFarmId, formData);
      // Update the plots for this farm
      const updatedPlots = [...(plots[selectedFarmId] || []), response.plot];
      setPlots({ ...plots, [selectedFarmId]: updatedPlots });
      setShowPlotForm(false);
    } catch (err) {
      console.error('Error adding plot:', err);
      throw new Error(err.response?.data?.message || 'Failed to add plot');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePlot = async (plotId, formData) => {
    if (!selectedFarmId) return;
    try {
      setIsSaving(true);
      setError('');
      const response = await farmService.updatePlot(selectedFarmId, plotId, formData);
      const updatedPlots = (plots[selectedFarmId] || []).map(p => p._id === plotId ? response.plot : p);
      setPlots({ ...plots, [selectedFarmId]: updatedPlots });
      setEditingPlot(null);
    } catch (err) {
      console.error('Error updating plot:', err);
      throw new Error(err.response?.data?.message || 'Failed to update plot');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFarm = async (farmId) => {
    try {
      setIsSaving(true);
      setError('');
      await farmService.deleteFarm(farmId);
      const newFarms = farms.filter(f => f._id !== farmId);
      setFarms(newFarms);
      const newPlots = { ...plots };
      delete newPlots[farmId];
      setPlots(newPlots);
      if (selectedFarmId === farmId) {
        setSelectedFarmId(newFarms.length > 0 ? newFarms[0]._id : null);
      }
      try { window.dispatchEvent(new CustomEvent('farmsUpdated', { detail: { deleted: farmId } })); } catch (e) { }
    } catch (err) {
      console.error('Error deleting farm:', err);
      setError(err.response?.data?.message || 'Failed to delete farm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlot = async (farmId, plotId) => {
    try {
      setIsSaving(true);
      setError('');
      await farmService.deletePlot(farmId, plotId);
      const updated = (plots[farmId] || []).filter(p => p._id !== plotId);
      setPlots({ ...plots, [farmId]: updated });
    } catch (err) {
      console.error('Error deleting plot:', err);
      setError(err.response?.data?.message || 'Failed to delete plot');
    } finally {
      setIsSaving(false);
    }
  };

  const openConfirm = ({ type, farmId = null, plotId = null, name = '' }) => {
    setConfirmData({ type, farmId, plotId, name });
    setConfirmVisible(true);
  };

  const closeConfirm = () => {
    setConfirmVisible(false);
    setConfirmData({ type: null, farmId: null, plotId: null, name: '' });
  };

  const confirmDelete = async () => {
    const { type, farmId, plotId } = confirmData;
    closeConfirm();
    if (type === 'farm' && farmId) await handleDeleteFarm(farmId);
    if (type === 'plot' && farmId && plotId) await handleDeletePlot(farmId, plotId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <Loader size={48} className="animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600 dark:text-gray-300">Loading your farms...</p>
        </div>
      </div>
    );
  }

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
          {filteredFarms.length > 0 ? (
            filteredFarms.map(farm => (
              <div
                key={farm._id}
                onClick={() => handleSelectFarm(farm._id)}
                className={`p-3 rounded-xl cursor-pointer transition duration-150 ${farm._id === selectedFarmId ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-l-4 border-green-500 shadow-inner' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{farm.name}</p>
                    <p className="text-xs opacity-70">{farm.subtitle || 'No subtitle'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openConfirm({ type: 'farm', farmId: farm._id, name: farm.name }); }} title="Delete farm" className="text-red-600 hover:text-red-900 p-1 rounded">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 p-3">No farms found</p>
          )}
        </nav>
      </aside>

      {/* Main Content stays in place */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 bg-gray-50 dark:bg-gray-900 min-h-screen overflow-y-auto transition-colors duration-300">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Farm & Plot Management</h1>
          {!showFarmForm && !editingFarm && (
            <button onClick={() => setShowFarmForm(true)} className="inline-flex items-center rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-700 transition duration-200">
              <Plus className="w-5 h-5 mr-1" /> Add New Farm
            </button>
          )}
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {showFarmForm ? (
          <AddFarmForm onAdd={handleAddFarm} onCancel={() => setShowFarmForm(false)} isLoading={isSaving} />
        ) : editingFarm ? (
          <EditFarmForm farm={editingFarm} onUpdate={handleEditFarm} onCancel={() => setEditingFarm(null)} isLoading={isSaving} />
        ) : selectedFarm ? (
          <div className="space-y-8 max-w-5xl">
            <FarmDetailsCard key={selectedFarm._id} farm={selectedFarm} onEdit={() => setEditingFarm(selectedFarm)} />

            {showPlotForm ? (
              <AddPlotForm
                farmId={selectedFarm._id}
                onAdd={handleAddPlot}
                onCancel={() => setShowPlotForm(false)}
                isLoading={isSaving}
              />
            ) : editingPlot ? (
              <EditPlotForm
                farmId={selectedFarm._id}
                plot={editingPlot}
                onUpdate={handleUpdatePlot}
                onCancel={() => setEditingPlot(null)}
                isLoading={isSaving}
              />
            ) : (
              <PlotsTable
                farm={selectedFarm}
                plots={plots}
                onAddPlotRequest={() => setShowPlotForm(true)}
                onDeletePlot={(plotId) => openConfirm({ type: 'plot', farmId: selectedFarm._id, plotId, name: '' })}
                onEditPlot={(plot) => setEditingPlot(plot)}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">
              {farms.length === 0 ? 'No farms yet. Click "Add New Farm" to get started!' : 'Select a farm from the sidebar to view details'}
            </p>
          </div>
        )}
      </main>
      <ConfirmModal
        visible={confirmVisible}
        title={confirmData.type === 'farm' ? 'Delete Farm' : 'Delete Plot'}
        message={confirmData.type === 'farm' ? `Delete farm "${confirmData.name}" and all its plots? This action cannot be undone.` : 'Delete this plot? This action cannot be undone.'}
        onCancel={closeConfirm}
        onConfirm={confirmDelete}
        isLoading={isSaving}
      />
    </div>
  );
};

// Confirmation modal (simple, reusable)
const ConfirmModal = ({ visible, title = 'Confirm', message, onCancel, onConfirm, isLoading }) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md z-10">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">Cancel</button>
          <button onClick={onConfirm} disabled={isLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{isLoading ? 'Deleting...' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
};

export default MyFarms;