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
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle
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

const ReportPreviewModal = ({ reportId, onClose, autoDownload = false, onAutoDownloadComplete }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef(null);
  const autoDownloadTriggeredRef = useRef(false);

  useEffect(() => {
    fetchReportPreview();
  }, [reportId]);

  useEffect(() => {
    hasAutoDownloadedRef.current = false;
  }, [reportId, autoDownload]);

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

  const handleDownload = async (closeAfterDownload = false) => {
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
      await html2pdf().set(options).from(contentRef.current).save();
      
      setDownloading(false);
      if (closeAfterDownload && typeof onAutoDownloadComplete === 'function') {
        onAutoDownloadComplete();
      }
    } catch (err) {
      console.error('Error downloading report:', err);
      setError('Failed to download report: ' + err.message);
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!autoDownload) {
      autoDownloadTriggeredRef.current = false;
      return;
    }

    if (!report || loading || error || downloading || autoDownloadTriggeredRef.current) return;

    autoDownloadTriggeredRef.current = true;
    handleDownload(true);
  }, [autoDownload, report, loading, error, downloading]);

  // 🔥 Dynamic severity styling
  useEffect(() => {
    if (!autoDownload) return;
    if (loading || error || downloading || !report || !contentRef.current) return;
    if (hasAutoDownloadedRef.current) return;

    hasAutoDownloadedRef.current = true;
    handleDownload();
  }, [autoDownload, loading, error, downloading, report]);
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
            <div ref={contentRef} className="bg-white dark:bg-gray-950">
              {/* Professional Header - Formal Layout */}
              <div className="bg-gradient-to-r from-green-800 to-green-900 dark:from-green-900 dark:to-black p-8 mb-6">
                <div className="flex justify-between items-start">
                  {/* Logo/Title Section */}
                  <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">CocoGuard</h1>
                    <p className="text-sm text-green-100 mt-1">Agricultural Disease Detection & Management System</p>
                  </div>
                  {/* Report Metadata */}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-green-100 uppercase tracking-wider">Report ID</p>
                    <p className="text-2xl font-bold text-white mt-1">{report.reportId}</p>
                    <p className="text-xs text-green-100 mt-3">Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Header Divider */}
              <div className="border-b-2 border-gray-300 dark:border-gray-700"></div>

              {/* Key Information Section */}
              <div className="border-b border-gray-200 dark:border-gray-700 p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {/* Location */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Location</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{report.farm}</p>
                  </div>

                  {/* Date */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Assessment Date</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>

                  {/* Disease/Issue */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Condition Detected</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{report.issue}</p>
                  </div>

                  {/* Severity Level */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Severity Level</p>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getSeverityColor(report.severity?.label)}`}>
                      {report.severity?.label || 'UNKNOWN'} ({report.severity?.value || 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-8 space-y-8">
                {/* Executive Summary */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-wide border-b-2 border-gray-300 dark:border-gray-700 pb-3">
                    Assessment Summary
                  </h2>
                  <div className="mt-4 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{report.description}</p>
                  </div>
                </section>

                {/* Status Information */}
                <section>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-wide border-b-2 border-gray-300 dark:border-gray-700 pb-3">
                    Report Status
                  </h2>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-l-4 border-gray-400 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Current Status</p>
                      <div className="flex items-center gap-2">
                        {report.status === 'Finalized' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        )}
                        <p className={`text-sm font-bold ${
                          report.status === 'Finalized'
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }`}>
                          {report.status}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Last Updated: {new Date(report.updatedAt).toLocaleString()}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-l-4 border-gray-400 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Assessed By</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{getUserDisplayName(report.userId) || 'Unknown'}</p>
                      {report.userId?.email && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {report.userId.email}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Field Evidence */}
                {report.images && report.images.length > 0 && (
                  <section>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-wide border-b-2 border-gray-300 dark:border-gray-700 pb-3">
                      Field Evidence
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 mb-4">{report.images.length} image(s) attached to this assessment</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {report.images.map((image, index) => (
                        <div key={index} className="border border-gray-300 dark:border-gray-700 rounded overflow-hidden bg-gray-100 dark:bg-gray-900">
                          <img
                            src={image}
                            alt={`Assessment evidence ${index + 1}`}
                            className="w-full h-48 object-cover"
                          />
                          <p className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-900 text-center">Evidence {index + 1}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Document Timestamps */}
                <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">Document Created</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{new Date(report.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">Last Modified</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{new Date(report.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Professional Footer */}
              <div className="border-t-2 border-gray-300 dark:border-gray-700 bg-gradient-to-r from-green-900 to-black dark:from-black dark:to-green-900 text-white p-6">
                <div className="max-w-4xl mx-auto">
                  <p className="text-xs font-semibold tracking-wide">COCOGUARD AGRICULTURAL MANAGEMENT SYSTEM</p>
                  <p className="text-xs text-green-100 mt-2">This is an official automated assessment document generated by the CocoGuard Disease Detection System. For inquiries about this report, please contact the agricultural assessment team.</p>
                  <div className="border-t border-green-700 mt-3 pt-3 flex justify-between items-center">
                    <p className="text-xs text-green-200">© 2026 CocoGuard. All rights reserved.</p>
                    <p className="text-xs text-green-200">Confidential Agricultural Assessment</p>
                  </div>
                </div>
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

