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

// Get all plots for a specific farm
export const getFarmPlots = async (farmId) => {
  const res = await API.get(`/farms/${farmId}/plots`);
  return res.data;
};

// Add a new plot to a farm
export const addPlot = async (farmId, plotData) => {
  const res = await API.post(`/farms/${farmId}/plots`, plotData);
  return res.data;
};

// Update a plot
export const updatePlot = async (farmId, plotId, plotData) => {
  const res = await API.put(`/farms/${farmId}/plots/${plotId}`, plotData);
  return res.data;
};

// Delete a plot
export const deletePlot = async (farmId, plotId) => {
  const res = await API.delete(`/farms/${farmId}/plots/${plotId}`);
  return res.data;
};
