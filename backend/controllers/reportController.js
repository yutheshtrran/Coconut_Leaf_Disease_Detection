// backend/controllers/reportController.js

const Report = require('../models/Report');

// Helper function to generate unique report ID
const generateReportId = async () => {
    const count = await Report.countDocuments();
    return `REP-${String(count + 1).padStart(3, '0')}`;
};

// Create a new report
exports.createReport = async (req, res) => {
    try {
        const { farm, date, issue, severity, status = 'Pending', description = '' } = req.body;
        const userId = req.user._id;

        // Only admin or agronomist may create reports
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'agronomist')) {
            return res.status(403).json({ message: 'Only admin or agronomist users can create reports' });
        }

        // Validation
        if (!farm || !date || !issue || !severity) {
            return res.status(400).json({ 
                message: 'Missing required fields: farm, date, issue, severity' 
            });
        }

        if (!severity.value || !severity.label) {
            return res.status(400).json({ 
                message: 'Severity must have value and label' 
            });
        }

        // Generate unique report ID
        const reportId = await generateReportId();

        const report = new Report({
            reportId,
            farm,
            date: new Date(date),
            issue,
            severity: {
                value: Number(severity.value),
                label: severity.label
            },
            status,
            userId,
            description,
            updatedAt: new Date()
        });

        await report.save();
        res.status(201).json({ 
            message: 'Report created successfully', 
            data: report 
        });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(400).json({ 
            message: 'Error creating report', 
            error: error.message 
        });
    }
};

// Get all reports (visible to all authenticated users)
exports.getReports = async (req, res) => {
    try {
        // Return all reports to authenticated users (visibility for all)
        const reports = await Report.find({})
            .sort({ createdAt: -1 })
            .populate('userId', 'name email');
        
        res.status(200).json({ 
            message: 'Reports retrieved successfully', 
            data: reports 
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ 
            message: 'Error retrieving reports', 
            error: error.message 
        });
    }
};

// Get a specific report by ID
exports.getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        // Support lookup by MongoDB _id or by reportId
        let report = null;
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
            report = await Report.findById(id).populate('userId', 'name email');
        }
        if (!report) {
            report = await Report.findOne({ reportId: id }).populate('userId', 'name email');
        }

        if (!report) return res.status(404).json({ message: 'Report not found' });

        // Any authenticated user may view reports
        return res.status(200).json({ message: 'Report retrieved successfully', data: report });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ 
            message: 'Error retrieving report', 
            error: error.message 
        });
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
            report = await Report.findById(id);
        }
        if (!report) report = await Report.findOne({ reportId: id });

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
        
        await report.save();
        
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
            report = await Report.findById(id);
        }
        if (!report) report = await Report.findOne({ reportId: id });

        if (!report) return res.status(404).json({ message: 'Report not found' });

        // Only admin or agronomist may delete reports
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'agronomist')) {
            return res.status(403).json({ message: 'Only admin or agronomist users can delete reports' });
        }

        await Report.findByIdAndDelete(report._id);
        return res.status(200).json({ message: 'Report deleted successfully', deletedReport: report });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ 
            message: 'Error deleting report', 
            error: error.message 
        });
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

        const reports = await Report.find(filter)
            .sort({ createdAt: -1 })
            .populate('userId', 'name email');
        
        res.status(200).json({ 
            message: 'Filtered reports retrieved successfully', 
            data: reports 
        });
    } catch (error) {
        console.error('Get filtered reports error:', error);
        res.status(500).json({ 
            message: 'Error retrieving filtered reports', 
            error: error.message 
        });
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
            report = await Report.findById(id).populate('userId', 'name email');
        }
        
        // If not found by _id, try finding by reportId
        if (!report) {
            report = await Report.findOne({ reportId: id }).populate('userId', 'name email');
        }
        
        if (!report) {
            return res.status(404).json({ 
                message: 'Report not found' 
            });
        }

        // Ensure user info exists to avoid runtime errors in the frontend
        let reportObj = report.toObject ? report.toObject() : report;
        if (!reportObj.userId) {
            reportObj.userId = { name: 'Unknown', email: 'Unknown' };
        }

        // Any authenticated user may preview reports
        res.status(200).json({ 
            message: 'Report preview data retrieved successfully', 
            data: reportObj 
        });
    } catch (error) {
        console.error('Preview report error:', error);
        res.status(500).json({ 
            message: 'Error previewing report', 
            error: error.message 
        });
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
            report = await Report.findById(id).populate('userId', 'name email');
        }
        
        // If not found by _id, try finding by reportId
        if (!report) {
            report = await Report.findOne({ reportId: id }).populate('userId', 'name email');
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

        // Add title
        doc.fontSize(24).font('Helvetica-Bold').text('Coconut Leaf Disease Detection Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text('____________________________________________________________________', { align: 'center' });
        doc.moveDown(1);

        // Add report metadata
        doc.fontSize(12).font('Helvetica-Bold').text('Report Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        // Prepare user fields safely
        const reportedBy = (report.userId && report.userId.name) ? report.userId.name : 'Unknown';
        const reportedEmail = (report.userId && report.userId.email) ? report.userId.email : 'Unknown';

        const reportData = [
            { label: 'Report ID', value: report.reportId },
            { label: 'Farm Name', value: report.farm },
            { label: 'Date', value: new Date(report.date).toLocaleDateString() },
            { label: 'Disease/Issue', value: report.issue },
            { label: 'Severity Level', value: `${report.severity.label} (${report.severity.value}%)` },
            { label: 'Status', value: report.status },
            { label: 'Description', value: report.description || 'No additional description' },
            { label: 'Reported By', value: reportedBy },
            { label: 'Email', value: reportedEmail },
            { label: 'Created At', value: new Date(report.createdAt).toLocaleString() },
            { label: 'Updated At', value: new Date(report.updatedAt).toLocaleString() }
        ];

        reportData.forEach(item => {
            doc.fontSize(11).font('Helvetica-Bold').text(item.label + ':', { width: 150 });
            doc.fontSize(10).font('Helvetica').text(item.value, { indent: 20 });
            doc.moveDown(0.3);
        });

        doc.moveDown(1);
        doc.fontSize(10).text('____________________________________________________________________', { align: 'center' });
        doc.moveDown(0.5);

        // Add footer
        doc.fontSize(9).fillColor('#999999').text('This is an automatically generated report from the Coconut Leaf Disease Detection System', { align: 'center' });
        doc.text('Report Generated on: ' + new Date().toLocaleString(), { align: 'center' });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ 
            message: 'Error generating report PDF', 
            error: error.message 
        });
    }
};