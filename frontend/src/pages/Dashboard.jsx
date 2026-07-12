import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, CheckCircle2, Wrench, CalendarCheck, ArrowLeftRight, AlertTriangle,
  Clock, Plus, BookOpen, AlertCircle, TrendingUp
} from 'lucide-react';
import api from '../api/axios';
import { formatDateTime, cn } from '../lib/utils';
import toast from 'react-hot-toast';

// Skeleton shimmer for loading states
function Skeleton({ className }) {
  return <div className={cn('rounded-lg bg-secondary animate-shimmer', className)} />;
}

// Stat Card
function StatCard({ label, value, icon: Icon, iconClass, delta, loading }) {
  if (loading) return <div className="stat-card"><Skeleton className="h-14" /></div>;
  return (
    <div className="stat-card animate-slide-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="stat-card-label">{label}</p>
        <div className={cn('stat-card-icon', iconClass)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="stat-card-value">{value ?? '—'}</p>
      {delta !== undefined && (
        <p className={cn('text-[11px] font-medium mt-1 flex items-center gap-1', delta > 0 ? 'text-emerald-400' : 'text-muted-foreground')}>
          {delta > 0 && <TrendingUp size={10} />}
          {delta > 0 ? `+${delta} today` : 'No change'}
        </p>
      )}
    </div>
  );
}

// Activity row
function ActivityRow({ action, target, user, createdAt }) {
  const actionColors = {
    ASSET_REGISTERED:   'text-blue-400',
    ASSET_ALLOCATED:    'text-emerald-400',
    ASSET_RETURNED:     'text-zinc-400',
    MAINTENANCE_RAISED: 'text-amber-400',
    MAINTENANCE_APPROVED: 'text-emerald-400',
    MAINTENANCE_RESOLVED: 'text-emerald-400',
    BOOKING_CREATED:    'text-violet-400',
    TRANSFER_REQUESTED: 'text-blue-400',
    TRANSFER_APPROVED:  'text-emerald-400',
    AUDIT_CREATED:      'text-violet-400',
    AUDIT_CLOSED:       'text-zinc-400',
    USER_PROMOTED:      'text-violet-400',
  };
  const actionLabel = action.replace(/_/g, ' ');

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 animate-fade-in">
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className={cn('font-semibold text-[11px] uppercase tracking-wider', actionColors[action] || 'text-muted-foreground')}>
            {actionLabel}
          </span>
          {' — '}
          <span className="text-foreground">{target}</span>
        </p>
        {user?.name && (
          <p className="text-[11px] text-muted-foreground mt-0.5">by {user.name}</p>
        )}
      </div>
      <time className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatDateTime(createdAt)}</time>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Today's Overview</h2>
          <p className="page-subtitle">
            {loading ? 'Loading dashboard...' : `Live status across ${(stats?.available ?? 0) + (stats?.allocated ?? 0)} tracked assets`}
          </p>
        </div>
      </div>

      {/* Stat Cards — matches mockup 2×2 top row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard loading={loading} label="Available"         value={stats?.available}        icon={Package}      iconClass="bg-emerald-500/15 text-emerald-400" />
        <StatCard loading={loading} label="Allocated"         value={stats?.allocated}         icon={CheckCircle2} iconClass="bg-blue-500/15 text-blue-400" />
        <StatCard loading={loading} label="Active Bookings"   value={stats?.activeBookings}    icon={CalendarCheck} iconClass="bg-violet-500/15 text-violet-400" />
        <StatCard loading={loading} label="Upcoming Returns"  value={stats?.upcomingReturns}   icon={Clock}        iconClass="bg-amber-500/15 text-amber-400" />
      </div>

      {/* Second stat row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard loading={loading} label="Pending Transfers"     value={stats?.pendingTransfers}  icon={ArrowLeftRight} iconClass="bg-blue-500/15 text-blue-400" />
        <StatCard loading={loading} label="Maintenance Today"     value={stats?.maintenanceToday}  icon={Wrench}         iconClass="bg-amber-500/15 text-amber-400" />
        <StatCard loading={loading} label="Overdue Returns"       value={stats?.overdueCount}      icon={AlertTriangle}  iconClass="bg-red-500/15 text-red-400" />
      </div>

      {/* Overdue Alert Strip */}
      {!loading && stats?.overdueCount > 0 && (
        <div className="alert-strip alert-strip-danger animate-slide-up">
          <AlertCircle size={16} className="shrink-0" />
          <p>
            <strong>{stats.overdueCount} asset{stats.overdueCount > 1 ? 's' : ''} overdue for return</strong>
            {' — '}
            {stats.overdueAllocations?.slice(0, 2).map(a => (
              <span key={a.id} className="mr-2">
                {a.asset?.tag} ({a.user?.name})
              </span>
            ))}
            {stats.overdueCount > 2 && `+${stats.overdueCount - 2} more`}
          </p>
        </div>
      )}

      {/* Quick Actions — matches mockup: "Register Asset | Book Resource | Raise Request" */}
      <div className="section-card">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/assets')}
            className="btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} /> Register Asset
          </button>
          <button
            onClick={() => navigate('/booking')}
            className="btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen size={13} /> Book Resource
          </button>
          <button
            onClick={() => navigate('/maintenance')}
            className="btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench size={13} /> Raise Request
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          <button
            onClick={() => navigate('/notifications')}
            className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            View all
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : stats?.recentActivity?.length > 0 ? (
          <div>
            {stats.recentActivity.map((log) => (
              <ActivityRow key={log.id} {...log} />
            ))}
          </div>
        ) : (
          <div className="empty-state py-8">
            <div className="empty-state-icon">
              <Clock size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No recent activity yet</p>
          </div>
        )}
      </div>

    </div>
  );
}
