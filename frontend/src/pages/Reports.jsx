import React, { useState, useEffect } from 'react';
import { Eye, Download, MoreHorizontal, ChevronLeft, ChevronRight, Filter, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import * as farmService from '../services/farmService';
import ReportPreviewModal from '../components/ReportPreviewModal';

// --- Helper Components ---
const StatsCard = ({ title, value, variant = 'default' }) => {
  let borderClasses = 'border-l-4 border-gray-200 dark:border-gray-600';
  let textClasses = 'text-gray-900 dark:text-gray-100';

  if (variant === 'critical') {
    borderClasses = 'border-l-4 border-red-500';
    textClasses = 'text-red-600 dark:text-red-400';
  } else if (variant === 'blue') {
    borderClasses = 'border-l-4 border-blue-500';
    textClasses = 'text-blue-600 dark:text-blue-400';
  }

  return (
    <div className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg transition duration-300 hover:shadow-xl ${borderClasses}`}>
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
      <p className={`mt-1 text-3xl font-extrabold ${textClasses}`}>{value}</p>
    </div>
  );
};

const SeverityBadge = ({ severity }) => {
  const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm min-w-[100px] justify-center";
  let colorClasses = '';
  switch (severity.color) {
    case 'red':
      colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      break;
    case 'blue':
      colorClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      break;
    case 'gray':
    default:
      colorClasses = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      break;
  }
  return (
    <div className={`${baseClasses} ${colorClasses}`}>
      <span className="w-6 text-right mr-1">{severity.value}%</span>
      <span className="font-bold">{severity.label}</span>
    </div>
  );
};

// --- Main Component ---
const Reports = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [previewConfig, setPreviewConfig] = useState({ reportId: null, autoDownload: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const canCreate = user && (user.role === 'agronomist' || user.role === 'admin');

  const canModify = user && (user.role === 'agronomist' || user.role === 'admin');

  const [newReportData, setNewReportData] = useState({
    farm: '',
    plot: '',
    date: '',
    issue: '',
    severityValue: '',
    severityLabel: 'LOW',
    status: 'Pending',
  });

  const [availablePlots, setAvailablePlots] = useState([]);
  const [plotsLoading, setPlotsLoading] = useState(false);

  const [filterData, setFilterData] = useState({
    farm: '',
    startDate: '',
    endDate: '',
    issue: '',
  });

  const reportsPerPage = 5;
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const currentReports = filteredReports.slice(startIndex, startIndex + reportsPerPage);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Fetch reports from backend
  useEffect(() => {
    if (user && !authLoading) {
      fetchReports();
    }
    // also load farms for selection in report form
    if (user && !authLoading) {
      fetchFarmsForForm();
    }
  }, [user, authLoading]);

  const [availableFarms, setAvailableFarms] = useState([]);

  const fetchFarmsForForm = async () => {
    try {
      const res = await farmService.getUserFarms();
      const list = res.farms || [];
      setAvailableFarms(list);
    } catch (err) {
      console.error('Failed to load farms for report form', err);
      setAvailableFarms([]);
    }
  };

  const fetchPlotsForFarm = async (farmId) => {
    if (!farmId) {
      setAvailablePlots([]);
      return;
    }
    try {
      setPlotsLoading(true);
      const res = await farmService.getFarmPlots(farmId);
      const list = res.plots || [];
      setAvailablePlots(list);
    } catch (err) {
      console.error('Failed to load plots for farm', err);
      setAvailablePlots([]);
    } finally {
      setPlotsLoading(false);
    }
  };

  // Fetch plots for the selected farm in the form when farm changes
  useEffect(() => {
    const farmNameOrId = newReportData.farm;
    if (!farmNameOrId) {
      setAvailablePlots([]);
      setNewReportData(prev => ({ ...prev, plot: '' }));
      return;
    }
    const farmObj = availableFarms.find(f => f._id === farmNameOrId || f.name === farmNameOrId);
    if (farmObj) {
      fetchPlotsForFarm(farmObj._id);
      setNewReportData(prev => ({ ...prev, plot: '' }));
    } else {
      setAvailablePlots([]);
      setNewReportData(prev => ({ ...prev, plot: '' }));
    }
  }, [newReportData.farm, availableFarms]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('current authenticated user (frontend):', user);
      const response = await API.get('/reports');
      console.log('fetchReports response:', response.status, response.data);
      
      const formattedReports = response.data.data.map(report => ({
        id: report._id,
        reportId: report.reportId,
        farm: report.farm,
        date: new Date(report.date).toISOString().split('T')[0],
        issue: report.issue,
        severity: {
          value: report.severity.value,
          label: report.severity.label,
          color: report.severity.label === 'CRITICAL' || report.severity.label === 'HIGH'
            ? 'red'
            : report.severity.label === 'MODERATE'
            ? 'blue'
            : 'gray'
        },
        status: report.status,
        createdAt: report.createdAt
      }));

      setReports(formattedReports);
      setFilteredReports(formattedReports);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching reports:', err);
      if (err.response?.status === 401) {
        navigate('/login', { replace: true });
      }
      setError(err.response?.data?.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleView = (reportId) => {
    setPreviewConfig({ reportId, autoDownload: false });
  };

  const handleDownload = (reportId) => {
    // Use the same preview-based PDF generator so output matches the eye view report.
    setPreviewConfig({ reportId, autoDownload: true });
  };

  const handleReportInputChange = (e) => {
    const { name, value } = e.target;
    setNewReportData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterInputChange = (e) => {
    const { name, value } = e.target;
    setFilterData(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterData.farm) params.farm = filterData.farm;
      if (filterData.startDate) params.startDate = filterData.startDate;
      if (filterData.endDate) params.endDate = filterData.endDate;
      if (filterData.issue) params.issue = filterData.issue;

      const response = await API.get('/reports/filter', { params });
      
      const formattedReports = response.data.data.map(report => ({
        id: report._id,
        reportId: report.reportId,
        farm: report.farm,
        date: new Date(report.date).toISOString().split('T')[0],
        issue: report.issue,
        severity: {
          value: report.severity.value,
          label: report.severity.label,
          color: report.severity.label === 'CRITICAL' || report.severity.label === 'HIGH'
            ? 'red'
            : report.severity.label === 'MODERATE'
            ? 'blue'
            : 'gray'
        },
        status: report.status,
        createdAt: report.createdAt
      }));

      setFilteredReports(formattedReports);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error applying filters:', err);
      setError(err.response?.data?.message || 'Failed to filter reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const basePayload = {
        date: newReportData.date,
        issue: newReportData.issue,
        severity: {
          value: Number(newReportData.severityValue),
          label: newReportData.severityLabel
        },
        status: newReportData.status
      };

      if (editingReportId) {
        const reportPayload = { ...basePayload, farm: newReportData.farm };
        if (newReportData.plot) reportPayload.plot = newReportData.plot;
        await API.put(`/reports/${editingReportId}`, reportPayload);
      } else {
        if (!newReportData.farm) throw new Error('Please select a farm for the report');
        const reportPayload = { ...basePayload, farm: newReportData.farm };
        if (newReportData.plot) reportPayload.plot = newReportData.plot;
        await API.post('/reports', reportPayload);
      }

      setSuccessMessage(editingReportId ? 'Report updated successfully!' : 'Report created successfully!');
      
      setTimeout(() => setSuccessMessage(''), 3000);

      setShowReportForm(false);
      setEditingReportId(null);
      setNewReportData({ farm: '', plot: '', date: '', issue: '', severityValue: '', severityLabel: 'LOW', status: 'Pending' });
      
      await fetchReports();
    } catch (err) {
      console.error('Error saving report:', err);
      setError(err.response?.data?.message || 'Failed to save report');
    }
  };

  const handleEditReport = (report) => {
    setNewReportData({
      farm: report.farm,
      plot: report.plot || '',
      date: report.date,
      issue: report.issue,
      severityValue: report.severity.value.toString(),
      severityLabel: report.severity.label,
      status: report.status
    });
    setEditingReportId(report.id);
    setShowReportForm(true);
  };

  const handleDeleteReport = async (reportId) => {
    try {
      setError(null);
      await API.delete(`/reports/${reportId}`);

      setSuccessMessage('Report deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowConfirmDelete(false);
      setConfirmDeleteId(null);
      await fetchReports();
    } catch (err) {
      console.error('Error deleting report:', err);
      setError(err.response?.data?.message || 'Failed to delete report');
    }
  };

  const showDeleteConfirm = (reportId) => {
    setConfirmDeleteId(reportId);
    setShowConfirmDelete(true);
  };

  const handleOpenForm = () => {
    setEditingReportId(null);
    setNewReportData({ farm: '', plot: '', date: '', issue: '', severityValue: '', severityLabel: 'LOW', status: 'Pending' });
    setShowReportForm(true);
  };

  const handleCloseForm = () => {
    setShowReportForm(false);
    setEditingReportId(null);
    setNewReportData({ farm: '', plot: '', date: '', issue: '', severityValue: '', severityLabel: 'LOW', status: 'Pending' });
  };

  const renderPaginationButton = (page, label) => (
    <button
      key={page}
      onClick={() => handlePageChange(page)}
      disabled={page === currentPage}
      className={`px-4 py-2 mx-1 text-sm font-medium rounded-lg transition duration-150
        ${page === currentPage ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50'}`}
    >
      {label}
    </button>
  );

  if (authLoading) {
    return (
      <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <div className="text-gray-600 dark:text-gray-400">Loading authentication...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <div className="text-gray-600 dark:text-gray-400">Please log in to view reports</div>
      </div>
    );
  }

  if (loading && reports.length === 0) {
    return (
      <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center items-center">
        <div className="text-gray-600 dark:text-gray-400">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen font-['Inter', sans-serif] transition-colors duration-300">
      {/* Report Preview Modal */}
      {previewConfig.reportId && (
        <ReportPreviewModal 
          reportId={previewConfig.reportId}
          autoDownload={previewConfig.autoDownload}
          onAutoDownloadComplete={() => setPreviewConfig({ reportId: null, autoDownload: false })}
          onClose={() => setPreviewConfig({ reportId: null, autoDownload: false })}
        />
      )}

      <div className="max-w-7xl mx-auto">

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showConfirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Delete Report</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to delete this report? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowConfirmDelete(false); setConfirmDeleteId(null); }}
                  className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteReport(confirmDeleteId)}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Title + Add Report Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Historical Analysis Reports</h1>
          {canCreate ? (
            <button
              onClick={handleOpenForm}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-150"
            >
              <Plus className="w-4 h-4" /> Add Report
            </button>
          ) : (
            <button
              disabled
              title="Only admin or agronomist can add reports"
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg shadow-sm cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Add Report
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard title="Total Reports" value={reports.length} variant="default" />
          <StatsCard title="Critical Alerts" value={reports.filter(r => r.severity.label === 'CRITICAL' || r.severity.label === 'HIGH').length} variant="critical" />
          <StatsCard title="Pending Reports" value={reports.filter(r => r.status === 'Pending').length} variant="blue" />
        </div>

        {/* Add/Edit Report Modal */}
        {showReportForm && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-2xl shadow-lg relative">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                {editingReportId ? 'Edit Report' : 'Add New Report'}
              </h2>
              <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Farm</label>
                  <div className="relative">
                    <select
                      name="farm"
                      value={newReportData.farm}
                      onChange={handleReportInputChange}
                      required
                      className="appearance-none w-full p-3 border rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                    >
                      <option value="" disabled>Choose a farm</option>
                      {availableFarms.map((f) => (
                        <option key={f._id} value={f.name}>{f.name}{f.subtitle ? ` • ${f.subtitle}` : ''}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Plot (optional)</label>
                  <div>
                    <select
                      name="plot"
                      value={newReportData.plot}
                      onChange={handleReportInputChange}
                      className="appearance-none w-full p-3 border rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                    >
                      {plotsLoading ? (
                        <option>Loading plots...</option>
                      ) : availablePlots.length > 0 ? (
                        <>
                          <option value="">(None)</option>
                          {availablePlots.map(p => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                        </>
                      ) : (
                        <option value="">No plots available</option>
                      )}
                    </select>
                  </div>
                </div>
                <input 
                  type="date" 
                  name="date" 
                  value={newReportData.date} 
                  onChange={handleReportInputChange} 
                  placeholder="Date" 
                  className="p-3 border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200" 
                  required 
                />
                <input 
                  type="text" 
                  name="issue" 
                  value={newReportData.issue} 
                  onChange={handleReportInputChange} 
                  placeholder="Major Issue" 
                  className="p-3 border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200" 
                  required 
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number" 
                    name="severityValue" 
                    value={newReportData.severityValue} 
                    onChange={handleReportInputChange} 
                    placeholder="Severity (%)" 
                    min="0"
                    max="100"
                    className="p-3 border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200" 
                    required 
                  />
                  <select 
                    name="severityLabel" 
                    value={newReportData.severityLabel} 
                    onChange={handleReportInputChange} 
                    className="p-3 border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MODERATE">MODERATE</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <select 
                  name="status" 
                  value={newReportData.status} 
                  onChange={handleReportInputChange} 
                  className="p-3 border rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200"
                >
                  <option value="Pending">Pending</option>
                  <option value="Finalized">Finalized</option>
                </select>

                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    type="button" 
                    onClick={handleCloseForm} 
                    className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
                  >
                    {editingReportId ? 'Update' : 'Save'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-8 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-indigo-600" />
            Report Filters
          </h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input 
                type="text" 
                name="farm"
                placeholder="Farm Name" 
                value={filterData.farm}
                onChange={handleFilterInputChange}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" 
              />
              <input 
                type="date" 
                name="startDate"
                placeholder="Start Date" 
                value={filterData.startDate}
                onChange={handleFilterInputChange}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" 
              />
              <input 
                type="date" 
                name="endDate"
                placeholder="End Date" 
                value={filterData.endDate}
                onChange={handleFilterInputChange}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" 
              />
              <input 
                type="text" 
                name="issue"
                placeholder="Issue Type" 
                value={filterData.issue}
                onChange={handleFilterInputChange}
                className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200"
              />
            </div>
            <button 
              onClick={handleApplyFilters}
              className="w-full p-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Report ID', 'Farm Name', 'Date', 'Major Issue', 'Severity', 'Status', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {currentReports.length > 0 ? (
                  currentReports.map(report => (
                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-100">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{report.reportId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.farm}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.issue}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm"><SeverityBadge severity={report.severity} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {/* View Report */}
                          <button
                            title="View Report"
                            onClick={() => handleView(report.reportId)}
                            className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          {/* Download Report */}
                          <button
                            title="Download Report"
                            onClick={() => handleDownload(report.reportId)}
                            className="text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                          >
                            <Download className="w-5 h-5" />
                          </button>

                          {/* Edit Report */}
                          {canModify && (
                            <>
                              {/* Edit Report */}
                              <button 
                                title="Edit Report" 
                                onClick={() => handleEditReport(report)} 
                                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>

                              {/* Delete Report */}
                              <button 
                                title="Delete Report" 
                                onClick={() => showDeleteConfirm(report.id)} 
                                className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No reports found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1} 
                  className="flex items-center px-4 py-2 mx-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition duration-150"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </button>
                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  return renderPaginationButton(pageNumber, pageNumber);
                })}
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages} 
                  className="flex items-center px-4 py-2 mx-1 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition duration-150"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Reports;
