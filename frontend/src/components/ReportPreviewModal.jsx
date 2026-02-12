import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Loader,
  Eye,
  Calendar,
  MapPin,
  AlertCircle,
  Mail,
  Clock
} from 'lucide-react';
import API from '../services/api';

// Derive a user display name from available fields (name, first/last, email)
const getUserDisplayName = (user) => {
  if (!user) return 'Unknown';

  // If user is a plain string (some APIs return user id/email as string)
  if (typeof user === 'string' && user.trim()) return user;

  const name = user.name || user.fullName;
  if (name && String(name).trim()) return String(name).trim();

  const first = user.firstName;
  const last = user.lastName;
  if ((first && first.trim()) || (last && last.trim())) {
    return `${(first || '').trim()} ${(last || '').trim()}`.trim();
  }

  // Fallback: use local-part of email (before @), prettify it
  if (user.email && user.email.includes('@')) {
    const local = user.email.split('@')[0];
    // replace dots/underscores with spaces and capitalize words
    return local
      .replace(/[._]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return 'Unknown';
};

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
      console.error(err);
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
      setError('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  // 🔥 Dynamic severity styling
  const getSeverityStyles = (label) => {
    if (label === 'CRITICAL' || label === 'HIGH')
      return {
        badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        bar: 'bg-red-600'
      };

    if (label === 'MODERATE')
      return {
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        bar: 'bg-amber-500'
      };

    return {
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      bar: 'bg-green-600'
    };
  };

  // Compute a stable display name for the reported user
  const displayName = report ? getUserDisplayName(report.userId) : 'Unknown';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 overflow-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl">

        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Report Preview
            </h2>
            {report && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                {report.reportId}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading report data...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={fetchReportPreview}
                  className="mt-2 text-sm underline"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : report && (
            <>
              {/* HERO */}
              <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Coconut Leaf Disease Detection Report
                </h3>
                <div className="flex justify-center gap-6 mt-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(report.date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {report.farm}
                  </span>
                </div>
              </div>

              {/* GRID */}
              <div className="grid md:grid-cols-2 gap-8">

                {/* LEFT */}
                <div className="space-y-5">
                  <DetailItem label="Disease / Issue" value={report.issue} />
                  <DetailItem label="Status" value={report.status} />

                  {/* SEVERITY */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Severity Level
                    </label>

                    {(() => {
                      const severity = getSeverityStyles(report.severity?.label);

                      return (
                        <div className="mt-2 flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${severity.badge}`}>
                            {report.severity?.label || 'UNKNOWN'}
                          </span>

                          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${severity.bar} transition-all duration-700`}
                              style={{ width: `${report.severity?.value || 0}%` }}
                            />
                          </div>

                          <span className="text-xs font-semibold text-gray-500">
                            {report.severity?.value || 0}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* RIGHT */}
                <div className="space-y-5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Reported By
                  </label>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                      {displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">
                        {displayName || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" />
                        {report.userId?.email || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DESCRIPTION */}
              {report.description && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Description
                  </label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
                    {report.description}
                  </p>
                </div>
              )}

              {/* IMAGES */}
              {report.images?.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-4">
                    Images
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {report.images.map((image, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`Report ${index + 1}`}
                          className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Eye className="text-white w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TIMESTAMPS */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 grid md:grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Created: {new Date(report.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated: {new Date(report.updatedAt).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-400 dark:hover:bg-gray-600 transition"
          >
            Close
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading || loading || error}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition"
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

const DetailItem = ({ label, value }) => (
  <div>
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
      {label}
    </label>
    <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mt-1">
      {value || 'N/A'}
    </p>
  </div>
);

export default ReportPreviewModal;
