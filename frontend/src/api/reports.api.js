import api from './axios';
export const getSummary = () => api.get('/reports/summary');
export const getUtilization = () => api.get('/reports/utilization');
export const getMaintenanceFreq = () => api.get('/reports/maintenance-freq');
export const getMostUsed = () => api.get('/reports/most-used');
export const getRetirementDue = () => api.get('/reports/retirement-due');
export const getBookingHeatmap = () => api.get('/reports/booking-heatmap');
export const exportReport = () => api.get('/reports/export', { responseType: 'blob' });
