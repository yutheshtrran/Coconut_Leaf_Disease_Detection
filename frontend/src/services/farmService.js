import API from './api';

// Add a new farm
export const addFarm = async (farmData) => {
  const res = await API.post('/farms', farmData);
  return res.data;
};

// Get all farms for the current user
export const getUserFarms = async () => {
  const res = await API.get('/farms');
  return res.data;
};

// Get a specific farm by ID
export const getFarmById = async (farmId) => {
  const res = await API.get(`/farms/${farmId}`);
  return res.data;
};

// Update a farm
export const updateFarm = async (farmId, farmData) => {
  const res = await API.put(`/farms/${farmId}`, farmData);
  return res.data;
};

// Delete a farm
export const deleteFarm = async (farmId) => {
  const res = await API.delete(`/farms/${farmId}`);
  return res.data;
};
