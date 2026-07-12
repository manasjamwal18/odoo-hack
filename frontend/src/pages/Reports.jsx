import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, Package, Clock, AlertTriangle, FileDown, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

// ── Simple Bar Chart (no external lib, pure CSS) ──────────────────────────────

function BarChart({ data, label, color = 'bg-primary' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{label}</h4>
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-bold">
              {d.value}
            </span>
            <div
              className={cn('w-full rounded-t-md transition-all duration-500', color)}
              style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
              role="img"
              aria-label={`${d.name}: ${d.value}`}
            />
            <span className="text-[10px] text-muted-foreground text-center leading-tight">{d.name}</span>
          </div>
        ))}
        {data.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Asset List Section ────────────────────────────────────────────────────────

function AssetList({ title, items, emptyMsg, colorClass }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {items.map((asset, i) => (
            <div key={asset.id || i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
              <div>
                <span className="font-mono text-xs text-primary font-semibold">{asset.tag}</span>
                <span className="ml-2 text-foreground">{asset.name}</span>
              </div>
              <span className={cn('text-xs font-medium', colorClass)}>
                {asset.metric || asset.daysLeft || asset.bookingCount || asset.idleDays}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/reports/summary');
      setData(d);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: blob } = await api.get('/reports/export', { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assetflow-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Reports & Analytics</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-secondary rounded-xl animate-shimmer" />)}
      </div>
    </div>
  );

  const utilizationData = data?.utilizationByDept || [];
  const maintenanceData = data?.maintenanceByMonth || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-subtitle">Utilization, maintenance frequency, and asset health</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-secondary">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
          Export Report
        </button>
      </div>

      {/* Charts row — matching Screen 9 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="section-card">
          <BarChart
            label="Utilization by Department"
            data={utilizationData.map(d => ({ name: d.department?.slice(0, 8), value: d.allocated }))}
            color="bg-primary"
          />
        </div>
        <div className="section-card">
          <BarChart
            label="Maintenance Frequency (last 6 months)"
            data={maintenanceData.map(d => ({ name: d.month?.slice(0, 3), value: d.count }))}
            color="bg-blue-500"
          />
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Most Used Assets (this month)',
            value: data?.mostUsedBookings ?? '—',
            sub: `${data?.topBookedAsset || '—'}: ${data?.bookingsThisMonth || 0} bookings`,
            icon: BarChart3, iconClass: 'bg-primary/15 text-primary',
          },
          {
            label: 'Maintenance Requests',
            value: data?.maintenanceThisMonth ?? '—',
            sub: 'this month',
            icon: TrendingUp, iconClass: 'bg-blue-500/15 text-blue-400',
          },
          {
            label: 'Idle Assets',
            value: data?.idleAssets ?? '—',
            sub: `avg ${data?.avgIdleDays || 0} days idle`,
            icon: Package, iconClass: 'bg-amber-500/15 text-amber-400',
          },
          {
            label: 'Overdue Returns',
            value: data?.overdueCount ?? '—',
            sub: 'awaiting return',
            icon: Clock, iconClass: 'bg-red-500/15 text-red-400',
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="stat-card-label">{s.label}</p>
              <div className={cn('stat-card-icon', s.iconClass)}>
                <s.icon size={15} />
              </div>
            </div>
            <p className="stat-card-value">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Most used + idle assets + maintenance due — matches Screen 9 bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="section-card">
          <AssetList
            title="Most Used Assets"
            items={data?.topAssets || []}
            emptyMsg="No booking data yet"
            colorClass="text-primary"
          />
        </div>
        <div className="section-card">
          <AssetList
            title="Idle Assets"
            items={data?.idleAssetList || []}
            emptyMsg="No idle assets"
            colorClass="text-amber-400"
          />
        </div>
        <div className="section-card">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Assets Due for Maintenance / Near Retirement
          </h4>
          {(data?.maintenanceDue || []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No alerts</p>
          ) : (
            <div className="space-y-2">
              {data.maintenanceDue.map(a => (
                <div key={a.id} className="text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className={a.nearRetirement ? 'text-amber-400' : 'text-red-400'} />
                    <span className="font-mono text-xs text-primary">{a.tag}</span>
                    <span className="text-foreground">{a.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
                    {a.nearRetirement
                      ? `${a.yearsOld} years old — nearing retirement`
                      : `Service due in ${a.daysLeft} days`}
                  </p>
                </div>
              ))}
            </div>
          )}
          {(data?.maintenanceDue || []).length > 0 && (
            <button onClick={handleExport} className="btn-secondary btn-sm mt-4 w-full">
              <FileDown size={12} /> Export Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
