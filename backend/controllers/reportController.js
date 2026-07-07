// backend/controllers/reportController.js

const Report   = require('../models/Report');
const Farm     = require('../models/Farm');
const { cloudinary } = require('../services/cloudinary');
const dbRetry  = require('../utils/dbRetry');

// Upload a raw base64 string (with or without data-URI prefix) to Cloudinary
async function uploadBase64ToCloudinary(b64) {
    const dataUri = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'reports/annotated',
        resource_type: 'image',
    });
    return result.secure_url;
}

// Helper function to generate unique report ID
const generateReportId = async () => {
    const count = await dbRetry(() => Report.countDocuments());
    return `REP-${String(count + 1).padStart(3, '0')}`;
};

// Derive a severity label from confidence (0–1) or percentage (0–100)
function deriveSeverity(topConfidence) {
    const pct = topConfidence > 1 ? topConfidence : topConfidence * 100;
    if (pct >= 80) return { value: Math.round(pct), label: 'CRITICAL' };
    if (pct >= 60) return { value: Math.round(pct), label: 'HIGH' };
    if (pct >= 40) return { value: Math.round(pct), label: 'MODERATE' };
    return { value: Math.round(pct), label: 'LOW' };
}

// Create a new report
exports.createReport = async (req, res) => {
    try {
        const {
            farm: farmName, farmId, date,
            issue: issueIn, severity: severityIn,
            status = 'Pending', description = '',
            analysisData, gps,
        } = req.body;
        const userId = req.user._id;

        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'agronomist')) {
            return res.status(403).json({ message: 'Only admin or agronomist users can create reports' });
        }

        // Resolve farm name — prefer farmId lookup, fall back to plain string
        let resolvedFarmName = farmName || '';
        let resolvedFarmId   = null;
        if (farmId) {
            const farmDoc = await dbRetry(() => Farm.findById(farmId).lean());
            if (farmDoc) {
                resolvedFarmName = farmDoc.name;
                resolvedFarmId   = farmDoc._id;
            }
        }

        // Auto-derive issue and severity from analysisData if not supplied
        let issue    = issueIn;
        let severity = severityIn;
        if (analysisData && analysisData.diseases && analysisData.diseases.length > 0) {
            const top = analysisData.diseases[0];
            if (!issue)    issue    = `${top.name} detected (${Math.round((top.topConfidence || 0) * 100)}%)`;
            if (!severity) severity = deriveSeverity(top.topConfidence || 0);
        }

        if (!resolvedFarmName || !date || !issue || !severity) {
            return res.status(400).json({ message: 'Missing required fields: farm, date, issue, severity' });
        }
        if (!severity.value || !severity.label) {
            return res.status(400).json({ message: 'Severity must have value and label' });
        }

        // Upload annotated images to Cloudinary, store URLs instead of base64
        let safeAnalysisData = analysisData ? { ...analysisData } : null;
        if (safeAnalysisData && Array.isArray(safeAnalysisData.annotatedImages) && safeAnalysisData.annotatedImages.length > 0) {
            const toUpload = safeAnalysisData.annotatedImages.slice(0, 3); // max 3
            const urls = await Promise.all(
                toUpload.map(b64 => uploadBase64ToCloudinary(b64).catch(() => null))
            );
            safeAnalysisData = {
                ...safeAnalysisData,
                annotatedImages: urls.filter(Boolean),
            };
        }

        const reportId = await generateReportId();
        const report = new Report({
            reportId,
            farm:         resolvedFarmName,
            farmId:       resolvedFarmId,
            date:         new Date(date),
            issue,
            severity:     { value: Number(severity.value), label: severity.label },
            status,
            userId,
            description,
            analysisData: safeAnalysisData,
            updatedAt:    new Date(),
        });

        await dbRetry(() => report.save());
        res.status(201).json({ message: 'Report created successfully', data: report });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(400).json({ message: 'Error creating report', error: error.message });
    }
};

// Get all reports (visible to all authenticated users)
exports.getReports = async (req, res) => {
    try {
        const reports = await dbRetry(() =>
            Report.find({}).sort({ createdAt: -1 }).populate('userId', 'name email')
        );
        res.status(200).json({ message: 'Reports retrieved successfully', data: reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ message: 'Error retrieving reports', error: error.message });
    }
};

// Get a specific report by ID
exports.getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        let report = await dbRetry(async () => {
            if (/^[0-9a-fA-F]{24}$/.test(id)) {
                const r = await Report.findById(id).populate('userId', 'name email');
                if (r) return r;
            }
            return Report.findOne({ reportId: id }).populate('userId', 'name email');
        });

        if (!report) return res.status(404).json({ message: 'Report not found' });
        return res.status(200).json({ message: 'Report retrieved successfully', data: report });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ message: 'Error retrieving report', error: error.message });
    }
};

// Update a report by ID
exports.updateReport = async (req, res) => {
    const { id } = req.params;
    try {
        const { farm, date, issue, severity, status, description } = req.body;
        
        // Find report first
        // Support lookup by _id or reportId
        let report = null;
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            report = await dbRetry(() => Report.findById(id));
        }
        if (!report) report = await dbRetry(() => Report.findOne({ reportId: id }));

        if (!report) return res.status(404).json({ message: 'Report not found' });

        // Only admin or agronomist may update reports
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'agronomist')) {
            return res.status(403).json({ message: 'Only admin or agronomist users can update reports' });
        }

        // Update fields
        if (farm) report.farm = farm;
        if (date) report.date = new Date(date);
        if (issue) report.issue = issue;
        if (severity) {
            report.severity = {
                value: Number(severity.value),
                label: severity.label
            };
        }
        if (status) report.status = status;
        if (description !== undefined) report.description = description;

        report.updatedAt = new Date();

        await dbRetry(() => report.save());
        
        res.status(200).json({ 
            message: 'Report updated successfully', 
            data: report 
        });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(400).json({ 
            message: 'Error updating report', 
            error: error.message 
        });
    }
};

// Delete a report by ID
exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        // Support lookup by _id or reportId
        let report = null;
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            report = await dbRetry(() => Report.findById(id));
        }
        if (!report) report = await dbRetry(() => Report.findOne({ reportId: id }));

        if (!report) return res.status(404).json({ message: 'Report not found' });

        // Only admin or agronomist may delete reports
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'agronomist')) {
            return res.status(403).json({ message: 'Only admin or agronomist users can delete reports' });
        }

        await dbRetry(() => Report.findByIdAndDelete(report._id));
        return res.status(200).json({ message: 'Report deleted successfully', deletedReport: report });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ 
            message: 'Error deleting report', 
            error: error.message 
        });
    }
};

// Delete all reports (admin only)
exports.deleteAllReports = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin users can delete all reports' });
        }
        const result = await dbRetry(() => Report.deleteMany({}));
        res.status(200).json({ message: `Deleted ${result.deletedCount} reports`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Delete all reports error:', error);
        res.status(500).json({ message: 'Error deleting all reports', error: error.message });
    }
};

// Get reports filtered by various criteria
exports.getFilteredReports = async (req, res) => {
    try {
        const { farm, startDate, endDate, issue, status } = req.query;

        // Allow filtering across all reports
        let filter = {};

        if (farm) filter.farm = { $regex: farm, $options: 'i' };
        if (issue) filter.issue = { $regex: issue, $options: 'i' };
        if (status) filter.status = status;
        
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        const reports = await dbRetry(() =>
            Report.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email')
        );
        res.status(200).json({ message: 'Filtered reports retrieved successfully', data: reports });
    } catch (error) {
        console.error('Get filtered reports error:', error);
        res.status(500).json({ message: 'Error retrieving filtered reports', error: error.message });
    }
};

// Preview report data (JSON response)
exports.previewReport = async (req, res) => {
    const { id } = req.params;
    try {
        // Try to find by mongoDB _id first, then by reportId
        let report = null;
        
        // Check if id looks like a MongoDB ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            report = await dbRetry(() =>
                Report.findById(id)
                    .populate('userId', 'name email')
                    .populate('farmId', 'name location address')
            );
        }

        if (!report) {
            report = await dbRetry(() =>
                Report.findOne({ reportId: id })
                    .populate('userId', 'name email')
                    .populate('farmId', 'name location address')
            );
        }

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        let reportObj = report.toObject ? report.toObject() : report;
        if (!reportObj.userId) {
            reportObj.userId = { name: 'Unknown', email: 'Unknown' };
        }

        res.status(200).json({
            message: 'Report preview data retrieved successfully',
            data: reportObj
        });
    } catch (error) {
        console.error('Preview report error:', error);
        res.status(500).json({ message: 'Error previewing report', error: error.message });
    }
};

// Generate and download report as PDF
exports.downloadReport = async (req, res) => {
    const { id } = req.params;
    try {
        // Try to find by mongoDB _id first, then by reportId
        let report = null;
        
        // Check if id looks like a MongoDB ObjectId (24 hex characters)
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            report = await dbRetry(() =>
                Report.findById(id)
                    .populate('userId', 'name email')
                    .populate('farmId', 'name location')
            );
        }

        // If not found by _id, try finding by reportId
        if (!report) {
            report = await dbRetry(() =>
                Report.findOne({ reportId: id })
                    .populate('userId', 'name email')
                    .populate('farmId', 'name location')
            );
        }

        if (!report) {
            return res.status(404).json({
                message: 'Report not found'
            });
        }

        // Any authenticated user may download reports
        const PDFDocument = require('pdfkit');
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${report.reportId}.pdf"`);

        // Create PDF document
        const doc = new PDFDocument();
        doc.pipe(res);

        const reportedBy = (report.userId && report.userId.name) ? report.userId.name : 'Unknown';

        // ── Cover / Header ─────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 100).fill('#1a5c2a');
        doc.fillColor('#ffffff')
           .fontSize(26).font('Helvetica-Bold')
           .text('CocoGuard', 40, 28);
        doc.fontSize(10).font('Helvetica')
           .text('Agricultural Disease Detection & Management System', 40, 60);

        doc.fillColor('#ffffff').fontSize(10)
           .text(`Report ID: ${report.reportId}`, { align: 'right' }, 40, 28)
           .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'right' });

        doc.moveDown(4);
        doc.fillColor('#000000');

        // ── Section helper ─────────────────────────────────────────────────
        const section = (title) => {
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a5c2a').text(title.toUpperCase());
            doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#1a5c2a').stroke();
            doc.moveDown(0.4);
            doc.fillColor('#000000').font('Helvetica').fontSize(10);
        };

        const row = (label, value) => {
            const y = doc.y;
            doc.font('Helvetica-Bold').text(label + ':', 40, y, { width: 140, continued: false });
            doc.font('Helvetica').text(String(value || '—'), 190, y);
            doc.moveDown(0.2);
        };

        // ── Report Information ─────────────────────────────────────────────
        section('Report Information');
        row('Report ID',      report.reportId);
        row('Farm',           report.farm);
        row('Date',           new Date(report.date).toLocaleDateString());
        row('Reported By',    reportedBy);
        row('Status',         report.status);

        // Farm GPS coordinates
        const gps = report.analysisData?.gps;
        if (gps?.lat != null) {
            row('GPS Coordinates', `${gps.lat.toFixed(6)}°N, ${gps.lon.toFixed(6)}°E (${gps.source || 'manual'})`);
        }

        // Farm saved location
        if (report.farmId?.location?.address) {
            row('Farm Address', report.farmId.location.address);
        }

        // ── Detected Condition ─────────────────────────────────────────────
        section('Detected Condition');
        row('Condition',  report.issue);
        row('Severity',   `${report.severity?.label || 'UNKNOWN'} (${report.severity?.value || 0}%)`);
        if (report.description) {
            doc.moveDown(0.2);
            doc.font('Helvetica').text(report.description, { indent: 10, width: doc.page.width - 80 });
        }

        // ── Analysis Summary ───────────────────────────────────────────────
        const ad = report.analysisData;
        if (ad) {
            section('Analysis Summary');
            const typeLabels = { leaf: 'Leaf Image Analysis', 'drone-image': 'Drone Image Analysis', 'drone-video': 'Drone Video Analysis' };
            row('Analysis Type',   typeLabels[ad.analysisType] || ad.analysisType);
            row('Total Images',    ad.totalImages ?? '—');
            row('Healthy',         `${ad.healthyPercent ?? '—'}%`);
            if (ad.treeSummary) {
                row('Total Trees',  ad.treeSummary.total);
                row('At Risk Trees', ad.treeSummary.atRisk);
            }
        }

        // ── Disease Breakdown ──────────────────────────────────────────────
        if (ad?.diseases?.length) {
            section('Disease Breakdown');
            ad.diseases.forEach((d, i) => {
                doc.font('Helvetica-Bold').text(`${i + 1}. ${d.name}`, { continued: false });
                doc.font('Helvetica').fontSize(9)
                   .text(`   ${d.count} occurrences · ${d.percentage}% of images · peak confidence ${Math.round((d.topConfidence || 0) * 100)}%`);
                if (d.description) doc.text(`   ${d.description}`, { indent: 10 });
                doc.moveDown(0.3);
            });
        }

        // ── Recovery Recommendations ───────────────────────────────────────
        if (ad?.diseases?.some(d => d.remedy)) {
            section('Recovery Recommendations');
            ad.diseases.filter(d => d.remedy).forEach(d => {
                doc.font('Helvetica-Bold').fontSize(10).text(d.name + ':');
                doc.font('Helvetica').fontSize(9).text(d.remedy, { indent: 12 });
                doc.moveDown(0.3);
            });
        }

        // ── Detection Evidence (first annotated image) ─────────────────────
        if (ad?.annotatedImages?.length) {
            section('Detection Evidence');
            try {
                const firstImg = ad.annotatedImages[0];
                const base64Data = firstImg.includes(',') ? firstImg.split(',')[1] : firstImg;
                const imgBuffer = Buffer.from(base64Data, 'base64');
                const maxW = doc.page.width - 80;
                doc.image(imgBuffer, 40, doc.y, { width: Math.min(maxW, 320), align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(8).fillColor('#666666').text('AI-annotated sample image', { align: 'center' });
                doc.fillColor('#000000').fontSize(10);
            } catch (imgErr) {
                doc.fontSize(9).fillColor('#666666').text('(Annotated image could not be embedded)');
                doc.fillColor('#000000').fontSize(10);
            }
        }

        // ── Footer ─────────────────────────────────────────────────────────
        doc.moveDown(2);
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor('#999999')
           .text('COCOGUARD AGRICULTURAL MANAGEMENT SYSTEM — Confidential Assessment', { align: 'center' });
        doc.text('Report Generated: ' + new Date().toLocaleString(), { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ 
            message: 'Error generating report PDF', 
            error: error.message 
        });
    }
};