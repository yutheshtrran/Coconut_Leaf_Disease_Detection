const Farm = require('../models/Farm');

// Add a new farm
exports.addFarm = async (req, res) => {
  try {
    const { name, subtitle, location, area, description } = req.body;
    const userId = req.user.id; // Get user ID from auth middleware

    // Validate required fields
    if (!name || !area) {
      return res.status(400).json({ message: 'Farm name and area are required' });
    }

    const newFarm = new Farm({
      name,
      subtitle: subtitle || '',
      location: location || '',
      area,
      description: description || '',
      admin: userId,
    });

    await newFarm.save();
    
    // Populate admin details before sending response
    await newFarm.populate('admin', 'username email');

    res.status(201).json({
      message: 'Farm added successfully',
      farm: newFarm,
    });
  } catch (error) {
    console.error('Error adding farm:', error);
    res.status(500).json({ message: 'Error adding farm', error: error.message });
  }
};

// Get all farms for the current user
exports.getUserFarms = async (req, res) => {
  try {
    const userId = req.user.id;

    const farms = await Farm.find({ admin: userId })
      .populate('admin', 'username email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Farms retrieved successfully',
      farms,
    });
  } catch (error) {
    console.error('Error fetching farms:', error);
    res.status(500).json({ message: 'Error fetching farms', error: error.message });
  }
};

// Get a specific farm by ID
exports.getFarmById = async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.id;

    const farm = await Farm.findById(farmId).populate('admin', 'username email');

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    // Check if the user is the farm owner or an admin
    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to access this farm' });
    }

    res.status(200).json({
      message: 'Farm retrieved successfully',
      farm,
    });
  } catch (error) {
    console.error('Error fetching farm:', error);
    res.status(500).json({ message: 'Error fetching farm', error: error.message });
  }
};

// Update a farm
exports.updateFarm = async (req, res) => {
  try {
    const { farmId } = req.params;
    const { name, subtitle, location, area, description, status } = req.body;
    const userId = req.user.id;

    const farm = await Farm.findById(farmId);

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    // Check if the user is the farm owner or an admin
    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to update this farm' });
    }

    // Update fields
    if (name) farm.name = name;
    if (subtitle) farm.subtitle = subtitle;
    if (location) farm.location = location;
    if (area) farm.area = area;
    if (description !== undefined) farm.description = description;
    if (status) farm.status = status;

    await farm.save();
    await farm.populate('admin', 'username email');

    res.status(200).json({
      message: 'Farm updated successfully',
      farm,
    });
  } catch (error) {
    console.error('Error updating farm:', error);
    res.status(500).json({ message: 'Error updating farm', error: error.message });
  }
};

// Delete a farm
exports.deleteFarm = async (req, res) => {
  try {
    const { farmId } = req.params;
    const userId = req.user.id;

    const farm = await Farm.findById(farmId);

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    // Check if the user is the farm owner or an admin
    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete this farm' });
    }

    await Farm.findByIdAndDelete(farmId);

    res.status(200).json({
      message: 'Farm deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting farm:', error);
    res.status(500).json({ message: 'Error deleting farm', error: error.message });
  }
};
