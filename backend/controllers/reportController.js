// backend/controllers/reportController.js

const Report = require('../models/Report');

// Create a new report
exports.createReport = async (req, res) => {
    try {
        const report = new Report(req.body);
        await report.save();
        res.status(201).send(report);
    } catch (error) {
        res.status(400).send(error);
    }
};

// Get all reports
exports.getReports = async (req, res) => {
    try {
        const reports = await Report.find({});
        res.status(200).send(reports);
    } catch (error) {
        res.status(500).send(error);
    }
};

// Get a report by ID
exports.getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await Report.findById(id);
        if (!report) {
            return res.status(404).send();
        }
        res.status(200).send(report);
    } catch (error) {
        res.status(500).send(error);
    }
};

// Update a report by ID
exports.updateReport = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await Report.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!report) {
            return res.status(404).send();
        }
        res.status(200).send(report);
    } catch (error) {
        res.status(400).send(error);
    }
};

// Delete a report by ID
exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await Report.findByIdAndDelete(id);
        if (!report) {
            return res.status(404).send();
        }
        res.status(200).send(report);
    } catch (error) {
        res.status(500).send(error);
    }
};