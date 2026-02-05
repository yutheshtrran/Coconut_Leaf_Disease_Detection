import React, { useState } from 'react';
import { Eye, Download, MoreHorizontal, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

// --- Mock Data ---
const currentYear = new Date().getFullYear();
const initialReports = [
  { id: 'REP-005', farm: 'Farm A', date: `${currentYear}-10-26`, issue: 'Potassium Deficiency', severity: { value: 92, label: 'CRITICAL', color: 'red' }, status: 'Finalized' },
  { id: 'REP-004', farm: 'Farm B', date: `${currentYear}-10-25`, issue: 'Nitrogen Deficiency', severity: { value: 85, label: 'HIGH', color: 'red' }, status: 'Finalized' },
  { id: 'REP-003', farm: 'Farm C', date: `${currentYear}-10-24`, issue: 'Water Stress', severity: { value: 45, label: 'MODERATE', color: 'blue' }, status: 'Finalized' },
  { id: 'REP-002', farm: 'Farm A', date: `${currentYear}-10-23`, issue: 'Pest Infestation', severity: { value: 68, label: 'MODERATE', color: 'blue' }, status: 'Finalized' },
  { id: 'REP-001', farm: 'Farm D', date: `${currentYear}-10-22`, issue: 'Nutrient Imbalance', severity: { value: 30, label: 'MODERATE', color: 'blue' }, status: 'Finalized' },
  { id: 'REP-006', farm: 'Farm E', date: `${currentYear}-10-27`, issue: 'Soil Erosion', severity: { value: 15, label: 'LOW', color: 'gray' }, status: 'Finalized' },
  { id: 'REP-007', farm: 'Farm F', date: `${currentYear}-10-28`, issue: 'Fungal Infection', severity: { value: 78, label: 'HIGH', color: 'red' }, status: 'Pending' },
  { id: 'REP-008', farm: 'Farm C', date: `${currentYear}-10-29`, issue: 'Weed Competition', severity: { value: 20, label: 'LOW', color: 'gray' }, status: 'Finalized' },
];

const totalReports = initialReports.length;
const criticalAlerts = initialReports.filter(r => r.severity.label === 'CRITICAL' || r.severity.label === 'HIGH').length;

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
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 5;
  const totalPages = Math.ceil(initialReports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const currentReports = initialReports.slice(startIndex, startIndex + reportsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
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

  const API_BASE = "http://127.0.0.1:5000";
  // Open PDF in a new tab
  const handleView = (reportId) => {
    window.open(`${API_BASE}/report/view/${reportId}`, "_blank");
  };

  // Download PDF
  const handleDownload = (reportId) => {
    const link = document.createElement("a");
    link.href = `${API_BASE}/report/download/${reportId}`;
    link.download = `${reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen font-['Inter', sans-serif] transition-colors duration-300">
      <div className="max-w-7xl mx-auto">

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-8">Historical Analysis Reports</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard title="Total Reports" value={totalReports} variant="default" />
          <StatsCard title="Critical Alerts" value={criticalAlerts} variant="critical" />
          <StatsCard title="Average FN Rate" value="5%" variant="blue" />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-8 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center">
            <Filter className="w-5 h-5 mr-2 text-indigo-600" />
            Report Filters
          </h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input type="text" placeholder="Farm Name" className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" />
              <input type="text" placeholder="Start Date" className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => e.target.type = 'text'} />
              <input type="text" placeholder="End Date" className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-200" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => e.target.type = 'text'} />
              <select className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white dark:bg-gray-700 dark:text-gray-200">
                <option>All Issues</option>
                <option>Potassium Deficiency</option>
                <option>Water Stress</option>
                <option>Pest Infestation</option>
              </select>
            </div>
            <button className="w-full p-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150">
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
                {currentReports.map(report => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-100">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{report.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.farm}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.issue}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><SeverityBadge severity={report.severity} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{report.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          title="View Report"
                          onClick={() => handleView(report.id)}
                          className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                        >
                          <Eye className="w-5 h-5" />
                        </button>

                        <button
                          title="Download Report"
                          onClick={() => handleDownload(report.id)}
                          className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"
                        >
                          <Download className="w-5 h-5" />
                        </button>

                        <button title="More Actions" className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150"><MoreHorizontal className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-end p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center space-x-1">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center px-4 py-2 mx-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition duration-150">
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </button>
              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1;
                return renderPaginationButton(pageNumber, pageNumber);
              })}
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center px-4 py-2 mx-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition duration-150">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Reports;
