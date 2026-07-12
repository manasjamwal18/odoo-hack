import api from './axios';
export const getAllocations = () => api.get('/allocations');
export const getOverdue = () => api.get('/allocations/overdue');
export const allocate = (data) => api.post('/allocations', data);
export const returnAsset = (id, conditionNotes) => api.put(`/allocations/${id}/return`, { conditionNotes });
export const createTransfer = (data) => api.post('/allocations/transfer', data);
export const approveTransfer = (id) => api.put(`/allocations/transfer/${id}/approve`);
export const rejectTransfer = (id) => api.put(`/allocations/transfer/${id}/reject`);
