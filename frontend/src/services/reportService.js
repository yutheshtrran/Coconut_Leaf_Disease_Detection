import API from './api';

export const fetchReports = async () => {
    const res = await API.get('/reports');
    return res.data;
};

export const createReport = async (reportData) => {
    const res = await API.post('/reports', reportData);
    return res.data;
};

export const updateReport = async (reportId, reportData) => {
    const res = await API.put(`/reports/${reportId}`, reportData);
    return res.data;
};

export const deleteReport = async (reportId) => {
    await API.delete(`/reports/${reportId}`);
};

export const previewReport = async (id) => {
    const res = await API.get(`/reports/${id}/preview`);
    return res.data;
};

export const fetchReportsByFarm = async (farmName) => {
    const res = await API.get('/reports/filter', { params: { farm: farmName } });
    return res.data;
};