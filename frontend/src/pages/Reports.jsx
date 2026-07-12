import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { BarChart3, TrendingUp, Package, Clock, AlertTriangle, FileDown, Loader2, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

// ── Custom Recharts Tooltip ────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Asset List Section ────────────────────────────────────────────────────────

function AssetList({ title, items, emptyMsg, colorClass, metricKey }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {items.map((asset, i) => {
            const metric = metricKey ? asset[metricKey] : (asset.metric ?? asset.bookingCount ?? asset.idleDays ?? '—');
            return (
              <div key={asset.id || i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-primary font-semibold shrink-0">{asset.tag}</span>
                  <span className="text-foreground truncate">{asset.name}</span>
                </div>
                <span className={cn('text-xs font-semibold shrink-0 ml-2', colorClass)}>{metric}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helper: format YYYY-MM to Month 'YY ──────────────────────────────────────

function formatMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [year, monthNum] = monthStr.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[parseInt(monthNum) - 1] || ''} '${year.slice(-2)}`;
}

// Chart colors (matching CSS design system)
const CHART_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EF4444', '#06B6D4'];

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
      a.download = `assetflow-report-${new Date().toISOString().split('T')[0]}.html`;
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
        <h2 className="page-title">Reports &amp; Analytics</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-56 bg-secondary rounded-xl animate-shimmer" />)}
      </div>
    </div>
  );

  // Utilization by dept: [{department, total, available, allocated, maintenance}]
  const utilizationData = (data?.utilizationByDept || []).map(d => ({
    name: d.department?.length > 12 ? d.department.slice(0, 12) + '…' : (d.department || 'Unassigned'),
    Available: d.available || 0,
    Allocated: d.allocated || 0,
    Maintenance: d.maintenance || 0,
  }));

  // Maintenance by month: [{month, count}]
  const maintenanceData = (data?.maintenanceByMonth || []).map(d => ({
    name: formatMonthLabel(d.month),
    Requests: d.count || 0,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reports &amp; Analytics</h2>
          <p className="page-subtitle">Utilization, maintenance frequency, and asset health</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReports} className="btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Export Report
          </button>
        </div>
      </div>

      {/* Charts row — Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Utilization by Department — BarChart (stacked) */}
        <div className="section-card">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Utilization by Department
          </h4>
          {utilizationData.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-16">No department data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={utilizationData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 16%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215 20% 45%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 45%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                <Bar dataKey="Available" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Allocated" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Maintenance" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Maintenance Frequency — LineChart */}
        <div className="section-card">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Maintenance Frequency (last 6 months)
          </h4>
          {maintenanceData.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-16">No maintenance data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={maintenanceData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 16%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215 20% 45%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 45%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone" dataKey="Requests" stroke="#3B82F6"
                  strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6, fill: '#3B82F6', stroke: 'hsl(222 47% 4%)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Most Used Asset',
            value: data?.topBookedAsset || '—',
            sub: `${data?.bookingsThisMonth || 0} bookings this month`,
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
            sub: `avg ${data?.avgIdleDays || 60}+ days idle`,
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
              <div className={cn('stat-card-icon', s.iconClass)}><s.icon size={15} /></div>
            </div>
            <p className="stat-card-value">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Asset lists: Most used + Idle + Maintenance Due */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="section-card">
          <AssetList
            title="Most Used Assets"
            items={data?.topAssets || []}
            emptyMsg="No booking data yet"
            colorClass="text-primary"
            metricKey="bookingCount"
          />
        </div>
        <div className="section-card">
          <AssetList
            title="Idle Assets"
            items={data?.idleAssetList || []}
            emptyMsg="No idle assets — great utilization!"
            colorClass="text-amber-400"
            metricKey="idleDays"
          />
        </div>
        <div className="section-card">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Assets Due for Maintenance / Near Retirement
          </h4>
          {(data?.maintenanceDue || []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No retirement alerts</p>
          ) : (
            <div className="space-y-2">
              {data.maintenanceDue.map(a => (
                <div key={a.id} className="text-sm py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className={a.nearRetirement ? 'text-amber-400' : 'text-red-400'} />
                    <span className="font-mono text-xs text-primary">{a.tag}</span>
                    <span className="text-foreground truncate">{a.name}</span>
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
