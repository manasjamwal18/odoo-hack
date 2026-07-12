import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function isOverdue(date) {
  if (!date) return false;
  return new Date(date) < new Date();
}

export function getStatusBadgeClass(status) {
  const map = {
    AVAILABLE: 'badge-available',
    ALLOCATED: 'badge-allocated',
    RESERVED: 'badge-reserved',
    UNDER_MAINTENANCE: 'badge-maintenance',
    LOST: 'badge-lost',
    RETIRED: 'badge-retired',
    DISPOSED: 'badge-disposed',
  };
  return map[status] || 'badge-retired';
}

export function getPriorityBadgeClass(priority) {
  const map = {
    LOW: 'badge-low',
    MEDIUM: 'badge-medium',
    HIGH: 'badge-high',
    CRITICAL: 'badge-critical',
  };
  return map[priority] || 'badge-low';
}

export function formatStatus(status) {
  return status?.replace(/_/g, ' ');
}
