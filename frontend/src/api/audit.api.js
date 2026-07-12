import api from './axios';
export const getAudits = () => api.get('/audits');
export const createAudit = (data) => api.post('/audits', data);
export const getAuditItems = (id) => api.get(`/audits/${id}/items`);
export const updateAuditItem = (auditId, itemId, data) => api.put(`/audits/${auditId}/items/${itemId}`, data);
export const getAuditReport = (id) => api.get(`/audits/${id}/report`);
export const closeAudit = (id) => api.put(`/audits/${id}/close`);
