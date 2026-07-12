import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, ShieldAlert, CheckCircle2, CalendarRange, Check, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

// ── Tab filter types — Screen 10 ──────────────────────────────────────────────
const TABS = [
  { key: 'all',       label: 'All',       icon: Bell },
  { key: 'ALERT',     label: 'Alerts',    icon: ShieldAlert },
  { key: 'APPROVAL',  label: 'Approvals', icon: CheckCircle2 },
  { key: 'BOOKING',   label: 'Bookings',  icon: CalendarRange },
];

const TYPE_ICONS = {
  ALERT:    { icon: ShieldAlert,   cls: 'text-red-400 bg-red-500/10' },
  APPROVAL: { icon: CheckCircle2,  cls: 'text-emerald-400 bg-emerald-500/10' },
  BOOKING:  { icon: CalendarRange, cls: 'text-violet-400 bg-violet-500/10' },
  INFO:     { icon: Bell,          cls: 'text-blue-400 bg-blue-500/10' },
};

// Relative time formatter
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Single Notification Row ───────────────────────────────────────────────────

function NotifRow({ notif, onMarkRead }) {
  const cfg = TYPE_ICONS[notif.type] || TYPE_ICONS.INFO;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-all duration-150',
        !notif.isRead ? 'bg-primary/3 hover:bg-primary/5' : 'hover:bg-secondary/30'
      )}
    >
      {/* Icon */}
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.cls)}>
        <Icon size={14} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !notif.isRead ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {notif.message}
        </p>
        {notif.resourceTag && (
          <span className="text-[11px] font-mono text-primary">{notif.resourceTag}</span>
        )}
      </div>

      {/* Time + mark read */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <time className="text-[11px] text-muted-foreground">{relativeTime(notif.createdAt)}</time>
        {!notif.isRead && (
          <button
            onClick={() => onMarkRead(notif.id)}
            className="w-2 h-2 rounded-full bg-primary shrink-0 hover:scale-150 transition-transform cursor-pointer"
            aria-label="Mark as read"
          />
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotifs();
    // Auto-poll every 30s
    intervalRef.current = setInterval(fetchNotifs, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifs]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
    } catch { toast.error('Failed to mark read'); }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      setNotifs(n => n.map(x => ({ ...x, isRead: true })));
      toast.success('All notifications marked read');
    } catch { toast.error('Failed'); }
    finally { setMarkingAll(false); }
  };

  const filtered = tab === 'all' ? notifs : notifs.filter(n => n.type === tab);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            Activity Logs & Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </h2>
          <p className="page-subtitle">System events, approvals, and alerts</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={markingAll} className="btn-secondary btn-sm">
            {markingAll ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs — Screen 10: All | Alerts | Approvals | Bookings */}
      <div className="tab-list w-fit">
        {TABS.map(t => {
          const count = t.key === 'all'
            ? notifs.filter(n => !n.isRead).length
            : notifs.filter(n => n.type === t.key && !n.isRead).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn('tab-btn flex items-center gap-1.5', tab === t.key && 'tab-btn-active')}
            >
              <t.icon size={12} />
              {t.label}
              {count > 0 && (
                <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full leading-none">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification list */}
      <div className="section-card !p-0 overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 p-4 border-b border-border/50">
                <div className="w-8 h-8 rounded-lg bg-secondary animate-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded animate-shimmer" />
                  <div className="h-3 w-1/2 bg-secondary rounded animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-16">
            <div className="empty-state-icon">
              <Bell size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {tab === 'all' ? 'No notifications yet' : `No ${tab.toLowerCase()} notifications`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Activity from all modules will appear here
            </p>
          </div>
        ) : (
          <div aria-live="polite" aria-atomic="false">
            {filtered.map(n => (
              <NotifRow key={n.id} notif={n} onMarkRead={markRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
