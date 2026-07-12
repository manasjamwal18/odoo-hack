import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../api/axios';
import ProfileModal from './ProfileModal';

const ROUTE_LABELS = {
  '/dashboard':     'Dashboard',
  '/org-setup':     'Organization Setup',
  '/assets':        'Asset Directory',
  '/allocation':    'Allocation & Transfer',
  '/booking':       'Resource Booking',
  '/maintenance':   'Maintenance',
  '/audit':         'Audit',
  '/reports':       'Reports & Analytics',
  '/notifications': 'Notifications',
};

export default function TopBar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  // Poll unread count
  useEffect(() => {
    const fetch = () =>
      api.get('/notifications/unread-count').then(({ data }) => setUnread(data.count || 0)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, []);

  const label = ROUTE_LABELS[location.pathname] || 'AssetFlow';

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">AssetFlow</span>
        <ChevronRight size={13} className="text-muted-foreground/50" />
        <span className="font-semibold text-foreground">{label}</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative btn-ghost btn-icon text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button
          onClick={() => setShowProfile(true)}
          className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary cursor-pointer hover:bg-primary/30 transition-colors overflow-hidden"
          aria-label={`Signed in as ${user?.name}`}
        >
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            user?.name?.charAt(0).toUpperCase()
          )}
        </button>
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </header>
  );
}
