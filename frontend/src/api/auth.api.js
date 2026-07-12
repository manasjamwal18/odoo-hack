import api from './axios';
export const login = (email, password) => api.post('/auth/login', { email, password });
export const signup = (name, email, password) => api.post('/auth/signup', { name, email, password });
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword });
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
