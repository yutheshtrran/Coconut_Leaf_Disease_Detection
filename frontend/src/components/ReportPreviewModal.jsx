import React, { useState, useEffect, useRef } from 'react';
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
import html2pdf from 'html2pdf.js';
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
  const contentRef = useRef(null);

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
      
      if (!contentRef.current) {
        throw new Error('Report content not available');
      }

      // html2pdf configuration
      const options = {
        margin: [10, 10, 10, 10],
        filename: `${report.reportId || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      // Generate PDF from the beautiful React component
      html2pdf().set(options).from(contentRef.current).save();
      
      setDownloading(false);
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report: ' + err.message);
      setDownloading(false);
    }
  };

  // 🔥 Dynamic severity styling
  const getSeverityColor = (label) => {
    switch (label?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'MODERATE':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-auto p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl my-8">
        {/* Header with Close Button */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10 rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Report Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[79vh]">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <Loader className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading report...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg m-6">
              <p className="font-semibold">Error loading report</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : report ? (
            <div ref={contentRef} className="bg-white dark:bg-gray-900">
              {/* Professional Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-8">
                <div className="flex justify-between items-start gap-8">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">🥥</span>
                    <div>
                      <h1 className="text-3xl font-bold">CocoGuard</h1>
                      <p className="text-green-100">Coconut Leaf Disease Detection Report</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-green-100">Report ID</p>
                    <p className="font-bold text-lg">{report.reportId}</p>
                    <p className="text-green-100 mt-2">Generated</p>
                    <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-gray-800">
                {/* Farm Card */}
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-l-4 border-green-500 shadow-sm hover:shadow-md transition">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Farm Name</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">🌾 {report.farm}</p>
                </div>

                {/* Date Card */}
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Report Date</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">📅 {new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>

                {/* Disease Card */}
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-l-4 border-amber-500 shadow-sm hover:shadow-md transition">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Disease/Issue</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">🦠 {report.issue}</p>
                </div>

                {/* Severity Card */}
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-l-4 border-red-500 shadow-sm hover:shadow-md transition">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Severity</p>
                  <div className="mt-1">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(report.severity?.label)}`}>
                      {report.severity?.label || 'UNKNOWN'} ({report.severity?.value || 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-8 space-y-6">
                {/* Description Section */}
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-l-4 border-green-500">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <span>📋</span> Disease Description
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{report.description}</p>
                </div>

                {/* Status & Reporter Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-l-4 border-blue-500">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <span>📍</span> Report Status
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</p>
                        <p className={`inline-block px-3 py-1 rounded mt-1 text-xs font-bold ${
                          report.status === 'Finalized' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {report.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Last Updated</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{new Date(report.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-l-4 border-purple-500">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <span>👤</span> Reported By
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 font-semibold">{getUserDisplayName(report.userId) || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{report.userId?.email || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Images Gallery */}
                {report.images && report.images.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-l-4 border-cyan-500">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <span>📸</span> Field Evidence ({report.images.length} images)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {report.images.map((image, index) => (
                        <div key={index} className="overflow-hidden rounded-lg shadow-md hover:shadow-lg transition">
                          <img
                            src={image}
                            alt={`Report evidence ${index + 1}`}
                            className="w-full h-40 object-cover hover:scale-105 transition duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold">Created: </p>
                      <p>{new Date(report.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Updated: </p>
                      <p>{new Date(report.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 p-6 text-center text-xs text-gray-600 dark:text-gray-400">
                <p className="font-semibold text-gray-700 dark:text-gray-300">CocoGuard © 2026 | Automated Disease Detection & Management System</p>
                <p className="mt-2">This report is optimized for viewing and printing. Use the Download button to save as PDF.</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Action Buttons */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky bottom-0 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || loading || error}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition"
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
