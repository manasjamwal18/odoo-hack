import { useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';

// Live notification stream over SSE. EventSource can't set headers,
// so the JWT rides in the query string; the backend verifies it there.
export function useLiveEvents() {
  const token = useAuthStore((s) => s.token);
  const { setUnreadCount, incrementUnread } = useUIStore();

  useEffect(() => {
    if (!token) return;

    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count))
      .catch(() => {});

    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    source.addEventListener('notification', (e) => {
      try {
        const n = JSON.parse(e.data);
        incrementUnread();
        toast(n.message, { icon: '🔔', duration: 5000 });
      } catch { /* malformed event — skip */ }
    });

    return () => source.close();
  }, [token, setUnreadCount, incrementUnread]);
}
