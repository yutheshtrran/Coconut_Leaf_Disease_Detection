import React, { useState, useEffect } from 'react';
import { X, Download, Loader } from 'lucide-react';
import API from '../services/api';

const ReportPreviewModal = ({ reportId, onClose }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchReportPreview();
  }, [reportId]);

  const fetchReportPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get(`/reports/${reportId}/preview`);
      setReport(response.data.data);
    } catch (err) {
      console.error('Error fetching report preview:', err);
      setError(err.response?.data?.message || 'Failed to load report preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = `${API.defaults.baseURL}/reports/${reportId}/download`;
      link.download = `${report.reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-2xl mx-4 my-8">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Report Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
              {error}
            </div>
          ) : report ? (
            <div className="space-y-6">
              {/* Report Title */}
              <div className="text-center border-b border-gray-300 dark:border-gray-600 pb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Coconut Leaf Disease Detection Report
                </h3>
              </div>

              {/* Report Information */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Report ID</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{report.reportId}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Farm Name</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{report.farm}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Report Date</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{new Date(report.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Disease/Issue</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{report.issue}</p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Severity Level</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            (report.severity?.label === 'CRITICAL' || report.severity?.label === 'HIGH')
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                              : report.severity?.label === 'MODERATE'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                            {report.severity?.label || 'UNKNOWN'} ({report.severity?.value ?? 0}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{report.status}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Reported By</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{report.userId?.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{report.userId?.email || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {report.description && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{report.description}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Created At</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Updated At</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{new Date(report.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              {report.images && report.images.length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-3">Images</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {report.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Report image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || loading || error}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition"
          >
            {downloading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPreviewModal;
