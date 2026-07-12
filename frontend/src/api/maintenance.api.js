import api from './axios';
export const getRequests = () => api.get('/maintenance');
export const createRequest = (data) => api.post('/maintenance', data);
export const approveRequest = (id) => api.put(`/maintenance/${id}/approve`);
export const rejectRequest = (id, notes) => api.put(`/maintenance/${id}/reject`, { notes });
export const assignTechnician = (id, technicianId) => api.put(`/maintenance/${id}/assign`, { technicianId });
export const progressRequest = (id) => api.put(`/maintenance/${id}/progress`);
export const resolveRequest = (id, notes) => api.put(`/maintenance/${id}/resolve`, { notes });
