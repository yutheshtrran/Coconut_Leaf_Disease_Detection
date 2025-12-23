import axios from 'axios';

// Use env var when available; fallback to explicit backend URL
// const baseURL = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:5000/api';
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const API = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  headers: {
    // 'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

// Transform request: Prevent Axios from overriding FormData with JSON serialization
API.defaults.transformRequest = [(data) => {
  // If data is FormData, return it untouched (browser sets correct multipart headers + boundary)
  if (data instanceof FormData) {
    return data;
  }
  // Otherwise, allow default JSON handling
  return data;
}];

// Response interceptor: on 401 try to refresh once then retry the request
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => API(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await API.post('/auth/refresh'); // server will set new cookies
        processQueue(null, true);
        return API(originalRequest);
      } catch (err) {
        processQueue(err, null);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default API;