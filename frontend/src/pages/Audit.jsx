import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardCheck, Loader2, X, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDate } from '../lib/utils';

// ── Create Audit Modal ────────────────────────────────────────────────────────

function CreateAuditModal({ employees, departments, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', scope: '', startDate: '', endDate: '', departmentId: '',
  });
  const [selectedAuditors, setSelectedAuditors] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleAuditor = (id) =>
    setSelectedAuditors(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate)
      return toast.error('Name and dates are required');
    setLoading(true);
    try {
      await api.post('/audits', {
        ...form,
        auditorIds: selectedAuditors,
        departmentId: form.departmentId || undefined,
      });
      toast.success('Audit cycle created');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create audit');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-lg animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">Create Audit Cycle</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="af-label">Cycle Name *</label>
            <input className="af-input" placeholder="Q3 Audit — Engineering Dept"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="af-label">Start Date *</label>
              <input type="date" className="af-input"
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="af-label">End Date *</label>
              <input type="date" className="af-input"
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="af-label">Scope (optional)</label>
            <input className="af-input" placeholder="e.g. All electronics in Bangalore office"
              value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} />
          </div>
          <div>
            <label className="af-label">Department Filter (optional)</label>
            <select className="af-select"
              value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
              <option value="">All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="af-label">Assign Auditors</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {employees.filter(e => ['ADMIN', 'ASSET_MANAGER'].includes(e.role)).map(emp => (
                <label key={emp.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={selectedAuditors.includes(emp.id)}
                    onChange={() => toggleAuditor(emp.id)}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer"
                  />
                  <span className="text-xs text-foreground">{emp.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Cycle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Audit Item Row ────────────────────────────────────────────────────────────

const RESULTS = [
  { value: 'PENDING',  label: 'Pending',  cls: 'text-muted-foreground' },
  { value: 'VERIFIED', label: 'Verified', cls: 'text-emerald-400' },
  { value: 'MISSING',  label: 'Missing',  cls: 'text-red-400' },
  { value: 'DAMAGED',  label: 'Damaged',  cls: 'text-amber-400' },
];

function AuditItemRow({ item, cycleId, onUpdate }) {
  const [result, setResult] = useState(item.result || 'PENDING');
  const [saving, setSaving] = useState(false);

  const handleChange = async (val) => {
    setResult(val);
    setSaving(true);
    try {
      await api.put(`/audits/${cycleId}/items/${item.id}`, { result: val });
    } catch { toast.error('Update failed'); setResult(item.result || 'PENDING'); }
    finally { setSaving(false); onUpdate(); }
  };

  const cls = RESULTS.find(r => r.value === result)?.cls || '';

  return (
    <tr>
      <td className="font-mono text-xs text-primary font-semibold">{item.asset?.tag}</td>
      <td className="font-medium">{item.asset?.name}</td>
      <td className="text-muted-foreground">{item.asset?.category?.name}</td>
      <td className="text-muted-foreground text-xs">{item.asset?.location || '—'}</td>
      <td>
        <div className="flex items-center gap-1.5">
          <select
            value={result}
            onChange={e => handleChange(e.target.value)}
            className={cn('af-select text-xs py-1.5 w-32 font-semibold', cls)}
          >
            {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          {result === 'MISSING' && <AlertTriangle size={13} className="text-red-400" />}
        </div>
      </td>
    </tr>
  );
}

// ── Audit Cycle Card ──────────────────────────────────────────────────────────

function CycleCard({ cycle, onClose, onRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await api.get(`/audits/${cycle.id}/items`);
      setItems(data);
    } catch { toast.error('Failed to load items'); }
    finally { setLoading(false); }
  }, [cycle.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleClose = async () => {
    if (!window.confirm('Close this audit cycle? Missing assets will be flagged.')) return;
    setClosing(true);
    try {
      await api.put(`/audits/${cycle.id}/close`);
      toast.success('Audit cycle closed');
      onRefresh();
      onClose();
    } catch { toast.error('Failed to close'); }
    finally { setClosing(false); }
  };

  const verified = items.filter(i => i.result === 'VERIFIED').length;
  const missing  = items.filter(i => i.result === 'MISSING').length;
  const damaged  = items.filter(i => i.result === 'DAMAGED').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">{cycle.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(cycle.startDate)} → {formatDate(cycle.endDate)} ·
              Auditors: {cycle.auditors?.map(a => a.name).join(', ') || 'None'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress summary */}
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-400 font-semibold">{verified} verified</span>
              <span className="text-amber-400 font-semibold">{damaged} damaged</span>
              <span className="text-red-400 font-semibold">{missing} missing</span>
            </div>
            {cycle.status !== 'CLOSED' && (
              <button onClick={handleClose} disabled={closing} className="btn-danger btn-sm">
                {closing ? <Loader2 size={12} className="animate-spin" /> : null}
                Close Audit Cycle
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Discrepancy note */}
        {missing > 0 && (
          <div className="mx-6 mt-4 alert-strip alert-strip-danger shrink-0">
            <AlertTriangle size={14} />
            <span className="text-xs">
              <strong>{missing} assets flagged</strong> — discrepancy report auto-generated on Close
            </span>
          </div>
        )}

        {/* Items table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="af-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Expected Location</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <AuditItemRow
                    key={item.id}
                    item={item}
                    cycleId={cycle.id}
                    onUpdate={fetchItems}
                  />
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No assets in scope
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Audit() {
  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, eRes, dRes] = await Promise.all([
        api.get('/audits'),
        api.get('/org/employees'),
        api.get('/org/departments'),
      ]);
      setCycles(cRes.data);
      setEmployees(eRes.data);
      setDepartments(dRes.data);
    } catch { toast.error('Failed to load audit data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCycles = cycles.filter(c => c.status !== 'CLOSED');
  const closedCycles = cycles.filter(c => c.status === 'CLOSED');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Asset Audit</h2>
          <p className="page-subtitle">Audit cycles, checklists, and discrepancy reporting</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={14} /> New Audit Cycle
        </button>
      </div>

      {/* Open cycles */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Cycles</h3>
        {loading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-secondary rounded-xl animate-shimmer" />)}</div>
        ) : openCycles.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon"><ClipboardCheck size={20} className="text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground">No active audit cycles</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to begin a physical verification</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 btn-sm">
              <Plus size={13} /> Create Audit Cycle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {openCycles.map(cycle => (
              <div
                key={cycle.id}
                onClick={() => setSelectedCycle(cycle)}
                className="section-card cursor-pointer hover:border-primary/30 transition-all duration-200 animate-fade-in"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{cycle.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(cycle.startDate)} → {formatDate(cycle.endDate)} ·
                      {cycle.items?.length || 0} assets in scope ·
                      Auditors: {cycle.auditors?.map(a => a.name).join(', ') || 'None assigned'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge badge-allocated">In Progress</span>
                    <ChevronDown size={16} className="text-muted-foreground -rotate-90" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Closed cycles */}
      {closedCycles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Closed Cycles</h3>
          <div className="space-y-2">
            {closedCycles.map(cycle => (
              <div
                key={cycle.id}
                onClick={() => setSelectedCycle(cycle)}
                className="flex items-center justify-between p-4 bg-secondary/30 border border-border/50 rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{cycle.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Closed · {cycle.items?.length || 0} assets audited
                  </p>
                </div>
                <span className="badge badge-retired">Closed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateAuditModal
          employees={employees}
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={fetchAll}
        />
      )}
      {selectedCycle && (
        <CycleCard
          cycle={selectedCycle}
          onClose={() => setSelectedCycle(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}
