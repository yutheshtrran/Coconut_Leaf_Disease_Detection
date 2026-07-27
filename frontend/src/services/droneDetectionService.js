import API from './api';

export const saveDetection = (payload) =>
  API.post('/drone-detections', payload).then(r => r.data);

export const listDetections = () =>
  API.get('/drone-detections').then(r => r.data.detections);

export const getDetection = (id) =>
  API.get(`/drone-detections/${id}`).then(r => r.data.detection);

export const deleteDetection = (id) =>
  API.delete(`/drone-detections/${id}`).then(r => r.data);
