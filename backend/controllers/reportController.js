// backend/controllers/reportController.js

const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');
const Report   = require('../models/Report');
const Farm     = require('../models/Farm');
const { cloudinary } = require('../services/cloudinary');
const dbRetry  = require('../utils/dbRetry');

function getErrorMessage(error) {
    return error?.response?.data?.message
        || error?.error?.message
        || error?.message
        || 'Unknown error';
}
function isInlineImage(value) {
    if (typeof value !== 'string') return false;
    if (value.startsWith('data:image/')) return true;
    if (/^https?:\/\//i.test(value)) return false;
    return value.length > 500 && /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

const CLOUDINARY_UPLOAD_TIMEOUT_MS = Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS || 300000);
const REPORT_UPLOAD_CONCURRENCY = Number(process.env.REPORT_UPLOAD_CONCURRENCY || 3);
const LOCAL_REPORT_ASSET_DIR = path.join(__dirname, '..', 'uploads', 'reports');
const PUBLIC_BASE_URL = (process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function mapLimit(items, limit, mapper) {
    const input = Array.isArray(items) ? items : [];
    const out = new Array(input.length);
    let index = 0;

    async function worker() {
        while (index < input.length) {
            const current = index++;
            out[current] = await mapper(input[current], current);
        }
    }

    const workers = Array.from({ length: Math.min(limit, input.length) }, worker);
    await Promise.all(workers);
    return out;
}

function parseDataImage(value) {
    const match = typeof value === 'string'
        ? value.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i)
        : null;
    if (match) {
        const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
        return { ext, base64: match[2] };
    }
    return { ext: 'jpg', base64: value };
}

async function saveReportImageLocally(value, folder = 'reports/annotated') {
    if (!isInlineImage(value)) return value;
    const { ext, base64 } = parseDataImage(value);
    const safeFolder = folder.replace(/^reports\/?/, '').replace(/[^a-z0-9/_-]/gi, '') || 'misc';
    const dir = path.join(LOCAL_REPORT_ASSET_DIR, safeFolder);
    await fs.promises.mkdir(dir, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(dir, filename);
    await fs.promises.writeFile(filePath, Buffer.from(base64, 'base64'));

    const urlPath = ['uploads', 'reports', safeFolder, filename]
        .map(part => encodeURIComponent(part).replace(/%2F/gi, '/'))
        .join('/');
    return `${PUBLIC_BASE_URL}/${urlPath}`;
}
// Upload a raw base64 string (with or without data-URI prefix) to Cloudinary.
// URLs are returned unchanged so already-externalized report assets stay stable.
async function uploadBase64ToCloudinary(value, folder = 'reports/annotated') {
    if (!isInlineImage(value)) return value;
    const dataUri = value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const result = await cloudinary.uploader.upload(dataUri, {
                folder,
                resource_type: 'image',
                timeout: CLOUDINARY_UPLOAD_TIMEOUT_MS,
            });
            return result.secure_url;
        } catch (err) {
            lastError = err;
            const timedOut = err?.http_code === 499 || /timeout/i.test(err?.message || err?.name || '');
            if (!timedOut || attempt === 3) break;
            await sleep(1000 * attempt);
        }
    }

    console.warn(`Cloudinary upload failed, saving report image locally: ${getErrorMessage(lastError)}`);
    return saveReportImageLocally(value, folder);
}

async function externalizeTreeImages(trees, folder) {
    if (!Array.isArray(trees)) return trees;
    return mapLimit(trees, REPORT_UPLOAD_CONCURRENCY, async (tree) => {
        const copy = { ...tree };
        if (copy.crop_image) {
            copy.crop_image = await uploadBase64ToCloudinary(copy.crop_image, folder);
        }
        return copy;
    });
}

async function externalizeAnalysisDataImages(analysisData) {
    if (!analysisData) return null;

    const safe = { ...analysisData };

    if (Array.isArray(safe.annotatedImages)) {
        safe.annotatedImages = await mapLimit(safe.annotatedImages, REPORT_UPLOAD_CONCURRENCY,
            img => uploadBase64ToCloudinary(img, 'reports/annotated')
        );
    }

    if (safe.mapImage) {
        safe.mapImage = await uploadBase64ToCloudinary(safe.mapImage, 'reports/maps');
    }

    safe.affectedTrees = await externalizeTreeImages(safe.affectedTrees, 'reports/tree-crops');
    safe.allTrees      = await externalizeTreeImages(safe.allTrees,      'reports/tree-crops');

    return safe;
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

        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
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
        // Fallback for healthy-only results (no diseases detected)
        if (!issue)    issue    = 'No disease detected — plantation healthy';
        if (!severity) severity = { value: 0, label: 'LOW' };

        if (!resolvedFarmName || !date) {
            return res.status(400).json({ message: 'Missing required fields: farm, date' });
        }
        if (severity.value == null || !severity.label) {
            return res.status(400).json({ message: 'Severity must have value and label' });
        }

        // Upload heavy inline images to Cloudinary, then save lightweight URLs in MongoDB.
        // This keeps large drone-image reports under MongoDB's 16 MB document limit.
        const safeAnalysisData = await externalizeAnalysisDataImages(analysisData);
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
        res.status(400).json({ message: 'Error creating report', error: getErrorMessage(error) });
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