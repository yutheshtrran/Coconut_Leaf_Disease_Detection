const Farm = require('../models/Farm');
const { reverseGeocode } = require('../utils/geocode');
const dbRetry = require('../utils/dbRetry');

// Normalise location: accept { lat, lon, address } object or legacy plain string
function normaliseLocation(location) {
  if (!location) return {};
  if (typeof location === 'object' && ('lat' in location || 'lon' in location)) {
    return {
      lat:     location.lat != null ? Number(location.lat) : undefined,
      lon:     location.lon != null ? Number(location.lon) : undefined,
      address: location.address || '',
    };
  }
  // Legacy plain string — store as address only
  return { address: String(location) };
}

// Add a new farm
exports.addFarm = async (req, res) => {
  try {
    const { name, subtitle, location, area, areaHectares, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: 'Farm name is required' });
    }

    const loc = normaliseLocation(location);
    if (loc.lat != null && loc.lon != null && !loc.address) {
      loc.address = (await reverseGeocode(loc.lat, loc.lon)) || '';
    }

    const newFarm = new Farm({
      name,
      subtitle:     subtitle || '',
      location:     loc,
      area:         area || '',
      areaHectares: areaHectares != null ? Number(areaHectares) : undefined,
      description:  description || '',
      admin:        userId,
    });

    await dbRetry(() => newFarm.save());
    await dbRetry(() => newFarm.populate('admin', 'username email'));

    res.status(201).json({ message: 'Farm added successfully', farm: newFarm });
  } catch (error) {
    console.error('Error adding farm:', error);
    res.status(500).json({ message: 'Error adding farm', error: error.message });
  }
};

// Get all farms — supports ?search=name for the report modal combobox
exports.getUserFarms = async (req, res) => {
  try {
    const userId  = req.user.id;
    const { search } = req.query;

    const query = { admin: userId };
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const farms = await dbRetry(() =>
      Farm.find(query).populate('admin', 'username email').sort({ createdAt: -1 })
    );

    res.status(200).json({ message: 'Farms retrieved successfully', farms });
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

    const farm = await dbRetry(() =>
      Farm.findById(farmId).populate('admin', 'username email')
    );

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to access this farm' });
    }

    res.status(200).json({ message: 'Farm retrieved successfully', farm });
  } catch (error) {
    console.error('Error fetching farm:', error);
    res.status(500).json({ message: 'Error fetching farm', error: error.message });
  }
};

// Update a farm
exports.updateFarm = async (req, res) => {
  try {
    const { farmId } = req.params;
    const { name, subtitle, location, area, areaHectares, description, status } = req.body;
    const userId = req.user.id;

    const farm = await dbRetry(() => Farm.findById(farmId));

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to update this farm' });
    }

    if (name)                      farm.name        = name;
    if (subtitle !== undefined)    farm.subtitle    = subtitle;
    if (location !== undefined)    farm.location    = normaliseLocation(location);
    if (area !== undefined)        farm.area        = area;
    if (areaHectares != null)      farm.areaHectares = Number(areaHectares);
    if (description !== undefined) farm.description = description;
    if (status)                    farm.status      = status;

    await dbRetry(() => farm.save());
    await dbRetry(() => farm.populate('admin', 'username email'));

    res.status(200).json({ message: 'Farm updated successfully', farm });
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

    const farm = await dbRetry(() => Farm.findById(farmId));

    if (!farm) {
      return res.status(404).json({ message: 'Farm not found' });
    }

    if (farm.admin.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to delete this farm' });
    }

    await dbRetry(() => Farm.findByIdAndDelete(farmId));

    res.status(200).json({ message: 'Farm deleted successfully' });
  } catch (error) {
    console.error('Error deleting farm:', error);
    res.status(500).json({ message: 'Error deleting farm', error: error.message });
  }
};
