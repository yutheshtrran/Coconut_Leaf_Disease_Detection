import axios from 'axios';

const API_URL = 'http://localhost:5000/api/reports'; // Adjust the URL as needed

export const fetchReports = async () => {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching reports:', error);
        throw error;
    }
};

export const createReport = async (reportData) => {
    try {
        const response = await axios.post(API_URL, reportData);
        return response.data;
    } catch (error) {
        console.error('Error creating report:', error);
        throw error;
    }
};

export const updateReport = async (reportId, reportData) => {
    try {
        const response = await axios.put(`${API_URL}/${reportId}`, reportData);
        return response.data;
    } catch (error) {
        console.error('Error updating report:', error);
        throw error;
    }
};

export const deleteReport = async (reportId) => {
    try {
        await axios.delete(`${API_URL}/${reportId}`);
    } catch (error) {
        console.error('Error deleting report:', error);
        throw error;
    }
};