const Plot = require('../models/Plot');
const Farm = require('../models/Farm');

// Add a new plot to a farm
exports.addPlot = async (req, res) => {
  try {
    const { farmId } = req.params;
    const { name, area, status, description } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !area) {
      return res.status(400).json({ message: 'Plot name and area are required' });
    }

    // Check if farm exists and belongs to the user
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to add plots to this farm' });
    }

    const newPlot = new Plot({
      farm: farmId,
      name,
      area: parseFloat(area),
      status: status || 'LOW_RISK',
      description: description || '',
    });

    await newPlot.save();

    res.status(201).json({
      message: 'Plot added successfully',
      plot: newPlot,
    });
  } catch (error) {
    console.error('Error adding plot:', error);
    res.status(500).json({ message: 'Error adding plot', error: error.message });
  }
};

// Get all plots for a farm
exports.getFarmPlots = async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.id;

    // Check if farm exists and belongs to the user
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to access plots for this farm' });
    }

    const plots = await Plot.find({ farm: farmId }).sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Plots retrieved successfully',
      plots,
    });
  } catch (error) {
    console.error('Error fetching plots:', error);
    res.status(500).json({ message: 'Error fetching plots', error: error.message });
  }
};

// Get a specific plot
exports.getPlotById = async (req, res) => {
  try {
    const { farmId, plotId } = req.params;
    const userId = req.user.id;

    // Check if farm exists and belongs to the user
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to access this farm' });
    }

    const plot = await Plot.findById(plotId);
    if (!plot) {
      return res.status(404).json({ message: 'Plot not found' });
    }

    if (plot.farm.toString() !== farmId) {
      return res.status(400).json({ message: 'Plot does not belong to this farm' });
    }

    res.status(200).json({
      message: 'Plot retrieved successfully',
      plot,
    });
  } catch (error) {
    console.error('Error fetching plot:', error);
    res.status(500).json({ message: 'Error fetching plot', error: error.message });
  }
};

// Update a plot
exports.updatePlot = async (req, res) => {
  try {
    const { farmId, plotId } = req.params;
    const { name, area, status, description } = req.body;
    const userId = req.user.id;

    // Check if farm exists and belongs to the user
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to update plots in this farm' });
    }

    const plot = await Plot.findById(plotId);
    if (!plot) {
      return res.status(404).json({ message: 'Plot not found' });
    }

    if (plot.farm.toString() !== farmId) {
      return res.status(400).json({ message: 'Plot does not belong to this farm' });
    }

    // Update fields
    if (name) plot.name = name;
    if (area !== undefined) plot.area = parseFloat(area);
    if (status) plot.status = status;
    if (description !== undefined) plot.description = description;

    await plot.save();

    res.status(200).json({
      message: 'Plot updated successfully',
      plot,
    });
  } catch (error) {
    console.error('Error updating plot:', error);
    res.status(500).json({ message: 'Error updating plot', error: error.message });
  }
};

// Delete a plot
exports.deletePlot = async (req, res) => {
  try {
    const { farmId, plotId } = req.params;
    const userId = req.user.id;

    // Check if farm exists and belongs to the user
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete plots in this farm' });
    }

    const plot = await Plot.findById(plotId);
    if (!plot) {
      return res.status(404).json({ message: 'Plot not found' });
    }

    if (plot.farm.toString() !== farmId) {
      return res.status(400).json({ message: 'Plot does not belong to this farm' });
    }

    await Plot.findByIdAndDelete(plotId);

    res.status(200).json({
      message: 'Plot deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting plot:', error);
    res.status(500).json({ message: 'Error deleting plot', error: error.message });
  }
};
