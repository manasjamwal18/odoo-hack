import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Filter, X, Loader2, Package, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDate, getStatusBadgeClass, formatStatus } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

// ── Register Asset Modal ───────────────────────────────────────────────────────

function RegisterModal({ categories, departments, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', categoryId: '', serialNumber: '', acquisitionDate: '',
    acquisitionCost: '', condition: 'Good', location: '', departmentId: '', isBookable: false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const change = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const conditions = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.categoryId) errs.categoryId = 'Required';
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/assets', form);
      toast.success('Asset registered');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register asset');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-card-hover animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Register New Asset</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="af-label">Asset Name *</label>
              <input className={cn('af-input', errors.name && 'border-destructive/70')}
                value={form.name} onChange={change('name')} placeholder="e.g. Dell Laptop" />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="af-label">Category *</label>
              <select className={cn('af-select', errors.categoryId && 'border-destructive/70')}
                value={form.categoryId} onChange={change('categoryId')}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.categoryId && <p className="text-xs text-red-400 mt-1">{errors.categoryId}</p>}
            </div>
            <div>
              <label className="af-label">Department</label>
              <select className="af-select" value={form.departmentId} onChange={change('departmentId')}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="af-label">Serial Number</label>
              <input className="af-input" value={form.serialNumber} onChange={change('serialNumber')} placeholder="SN-XXX-2024" />
            </div>
            <div>
              <label className="af-label">Condition</label>
              <select className="af-select" value={form.condition} onChange={change('condition')}>
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="af-label">Acquisition Date</label>
              <input type="date" className="af-input" value={form.acquisitionDate} onChange={change('acquisitionDate')} />
            </div>
            <div>
              <label className="af-label">Cost (₹)</label>
              <input type="number" className="af-input" value={form.acquisitionCost} onChange={change('acquisitionCost')} placeholder="85000" />
            </div>
            <div className="col-span-2">
              <label className="af-label">Location</label>
              <input className="af-input" value={form.location} onChange={change('location')} placeholder="e.g. Bangalore, Floor 2" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="bookable" checked={form.isBookable}
                onChange={e => setForm(f => ({ ...f, isBookable: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary cursor-pointer" />
              <label htmlFor="bookable" className="text-sm text-foreground cursor-pointer">
                Bookable resource (conference rooms, vehicles, equipment)
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Asset Detail Panel ─────────────────────────────────────────────────────────

function AssetPanel({ asset, onClose }) {
  if (!asset) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-card border-l border-border w-full max-w-md h-full overflow-y-auto animate-slide-up shadow-card-hover"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="font-semibold text-foreground">{asset.tag}</h3>
            <p className="text-xs text-muted-foreground">{asset.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Status', value: <span className={cn('badge', getStatusBadgeClass(asset.status))}>{formatStatus(asset.status)}</span> },
              { label: 'Condition', value: asset.condition },
              { label: 'Category', value: asset.category?.name },
              { label: 'Department', value: asset.department?.name || '—' },
              { label: 'Location', value: asset.location || '—' },
              { label: 'Serial No.', value: asset.serialNumber || '—' },
              { label: 'Acquired', value: formatDate(asset.acquisitionDate) },
              { label: 'Cost', value: asset.acquisitionCost ? `₹${Number(asset.acquisitionCost).toLocaleString()}` : '—' },
              { label: 'Bookable', value: asset.isBookable ? 'Yes' : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                <div className="text-foreground font-medium">{value}</div>
              </div>
            ))}
          </div>

          {/* Allocation history */}
          {asset.allocations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Allocation History</p>
              <div className="space-y-2">
                {asset.allocations.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-foreground">{a.user?.name}</span>
                    <span className={cn('badge', a.status === 'ACTIVE' ? 'badge-allocated' : 'badge-retired')}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance history */}
          {asset.maintenanceRequests?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Maintenance History</p>
              <div className="space-y-2">
                {asset.maintenanceRequests.slice(0, 3).map(m => (
                  <div key={m.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                    <span className={cn('badge shrink-0 mt-0.5', `badge-${m.priority.toLowerCase()}`)}>{m.priority}</span>
                    <p className="text-muted-foreground">{m.issue}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────

const STATUSES = ['AVAILABLE', 'ALLOCATED', 'UNDER_MAINTENANCE', 'RESERVED', 'LOST', 'RETIRED'];

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ categoryId: '', status: '' });
  const [showRegister, setShowRegister] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const { user } = useAuthStore();
  const canRegister = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (filters.categoryId) params.category = filters.categoryId;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/assets', { params });
      setAssets(data);
    } catch { toast.error('Failed to load assets'); }
    finally { setLoading(false); }
  }, [search, filters]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAssets(), 300);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  useEffect(() => {
    Promise.all([api.get('/org/categories'), api.get('/org/departments')])
      .then(([c, d]) => { setCategories(c.data); setDepartments(d.data); })
      .catch(() => {});
  }, []);

  const openAsset = async (asset) => {
    try {
      const { data } = await api.get(`/assets/${asset.id}`);
      setSelectedAsset(data);
    } catch { toast.error('Failed to load asset details'); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Asset Directory</h2>
          <p className="page-subtitle">{assets.length} assets found</p>
        </div>
        {canRegister && (
          <button onClick={() => setShowRegister(true)} className="btn-primary">
            <Plus size={14} /> Register Asset
          </button>
        )}
      </div>

      {/* Search + Filters — matches mockup */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by tag, serial, or QR code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="af-input pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={filters.categoryId}
          onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}
          className="af-select w-auto min-w-36"
        >
          <option value="">Category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="af-select w-auto min-w-36"
        >
          <option value="">Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
        {(filters.categoryId || filters.status) && (
          <button
            onClick={() => setFilters({ categoryId: '', status: '' })}
            className="btn-ghost btn-sm text-muted-foreground"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table — matches mockup: Tag / Name / Category / Status / Location */}
      <div className="af-table-wrapper">
        <table className="af-table">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Location</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-secondary rounded animate-shimmer" />
                    </td>
                  ))}
                </tr>
              ))
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Package size={20} className="text-muted-foreground" /></div>
                    <p className="text-sm font-medium text-foreground">No assets found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || filters.categoryId || filters.status
                        ? 'Try adjusting your filters'
                        : 'Register your first asset to get started'}
                    </p>
                    {canRegister && !search && (
                      <button onClick={() => setShowRegister(true)} className="btn-primary mt-4 btn-sm">
                        <Plus size={13} /> Register Asset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : assets.map(asset => (
              <tr key={asset.id} onClick={() => openAsset(asset)}>
                <td>
                  <span className="font-mono text-xs font-semibold text-primary">{asset.tag}</span>
                </td>
                <td className="font-medium">{asset.name}</td>
                <td className="text-muted-foreground">{asset.category?.name}</td>
                <td>
                  <span className={cn('badge', getStatusBadgeClass(asset.status))}>
                    {formatStatus(asset.status)}
                  </span>
                </td>
                <td className="text-muted-foreground text-xs">{asset.location || '—'}</td>
                <td className="text-muted-foreground text-xs">{asset.department?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showRegister && (
        <RegisterModal
          categories={categories}
          departments={departments}
          onClose={() => setShowRegister(false)}
          onSaved={fetchAssets}
        />
      )}
      {selectedAsset && (
        <AssetPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
