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

// Get all reports for authenticated user
exports.getReports = async (req, res) => {
    try {
        const userId = req.user._id;
        const reports = await Report.find({ userId })
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
        const report = await Report.findById(id).populate('userId', 'name email');
        
        if (!report) {
            return res.status(404).json({ 
                message: 'Report not found' 
            });
        }

        // Check if user owns this report
        if (report.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to view this report' 
            });
        }

        res.status(200).json({ 
            message: 'Report retrieved successfully', 
            data: report 
        });
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
        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({ 
                message: 'Report not found' 
            });
        }

        // Check ownership
        if (report.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to edit this report' 
            });
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
        const report = await Report.findById(id);
        
        if (!report) {
            return res.status(404).json({ 
                message: 'Report not found' 
            });
        }

        // Check ownership
        if (report.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to delete this report' 
            });
        }

        await Report.findByIdAndDelete(id);
        
        res.status(200).json({ 
            message: 'Report deleted successfully', 
            deletedReport: report 
        });
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
        const userId = req.user._id;
        const { farm, startDate, endDate, issue, status } = req.query;

        let filter = { userId };

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

        // Check if user owns this report
        if (report.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to preview this report' 
            });
        }

        res.status(200).json({ 
            message: 'Report preview data retrieved successfully', 
            data: report 
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

        // Check if user owns this report
        if (report.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to download this report' 
            });
        }

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

        const reportData = [
            { label: 'Report ID', value: report.reportId },
            { label: 'Farm Name', value: report.farm },
            { label: 'Date', value: new Date(report.date).toLocaleDateString() },
            { label: 'Disease/Issue', value: report.issue },
            { label: 'Severity Level', value: `${report.severity.label} (${report.severity.value}%)` },
            { label: 'Status', value: report.status },
            { label: 'Description', value: report.description || 'No additional description' },
            { label: 'Reported By', value: report.userId.name },
            { label: 'Email', value: report.userId.email },
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