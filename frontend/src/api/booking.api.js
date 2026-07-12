import api from './axios';
export const getBookings = (assetId) => api.get('/bookings', { params: assetId ? { assetId } : {} });
export const createBooking = (data) => api.post('/bookings', data);
export const cancelBooking = (id) => api.put(`/bookings/${id}/cancel`);
