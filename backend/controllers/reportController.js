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