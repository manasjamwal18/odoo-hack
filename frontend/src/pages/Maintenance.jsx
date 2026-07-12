import { useEffect, useState, useCallback } from 'react';
import { Plus, Wrench, Loader2, X, Check, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDate } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

// ── Kanban Column (Screen 7) ──────────────────────────────────────────────────

const COLUMNS = [
  { key: 'PENDING',            label: 'Pending',             color: 'text-zinc-400',   bg: 'bg-zinc-500/10 border-zinc-500/20' },
  { key: 'APPROVED',           label: 'Approved',            color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'TECHNICIAN_ASSIGNED',label: 'Technician Assigned', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { key: 'IN_PROGRESS',        label: 'In Progress',         color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { key: 'RESOLVED',           label: 'Resolved',            color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
];

const PRIORITY_COLORS = {
  LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high', CRITICAL: 'badge-critical',
};

function KanbanCard({ request, canManage, onAction, processing }) {
  const isProcessing = processing === request.id;
  return (
    <div className="kanban-card animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono text-[11px] text-primary font-semibold">{request.asset?.tag}</span>
        <span className={cn('badge shrink-0', PRIORITY_COLORS[request.priority])}>
          {request.priority}
        </span>
      </div>
      <p className="text-xs text-foreground font-medium leading-snug mb-1">{request.asset?.name}</p>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{request.issue}</p>
      <p className="text-[10px] text-muted-foreground">Raised by {request.raisedBy?.name}</p>
      <p className="text-[10px] text-muted-foreground">{formatDate(request.createdAt)}</p>

      {/* Action buttons per column */}
      {canManage && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {request.status === 'PENDING' && (
            <>
              <button onClick={() => onAction(request.id, 'approve')} disabled={isProcessing} className="btn-primary btn-sm text-[11px]">
                {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Approve
              </button>
              <button onClick={() => onAction(request.id, 'reject')} disabled={isProcessing} className="btn-danger btn-sm text-[11px]">
                <X size={10} /> Reject
              </button>
            </>
          )}
          {request.status === 'APPROVED' && (
            <button onClick={() => onAction(request.id, 'assign')} disabled={isProcessing} className="btn-secondary btn-sm text-[11px]">
              {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />} Assign Tech
            </button>
          )}
          {request.status === 'TECHNICIAN_ASSIGNED' && (
            <button onClick={() => onAction(request.id, 'progress')} disabled={isProcessing} className="btn-secondary btn-sm text-[11px]">
              {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />} Start Work
            </button>
          )}
          {request.status === 'IN_PROGRESS' && (
            <button onClick={() => onAction(request.id, 'resolve')} disabled={isProcessing} className="btn-primary btn-sm text-[11px]">
              {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ column, requests, canManage, onAction, processing }) {
  return (
    <div className="flex flex-col min-w-48 flex-1">
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-lg border mb-2', column.bg)}>
        <span className={cn('text-xs font-semibold', column.color)}>{column.label}</span>
        <span className={cn('text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center', column.bg, column.color)}>
          {requests.length}
        </span>
      </div>
      {/* Cards */}
      <div className="space-y-2 flex-1">
        {requests.length === 0 ? (
          <div className="border border-border/30 rounded-lg border-dashed p-4 text-center">
            <p className="text-[11px] text-muted-foreground/50">Empty</p>
          </div>
        ) : (
          requests.map(r => (
            <KanbanCard key={r.id} request={r} canManage={canManage} onAction={onAction} processing={processing} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Raise Request Modal ───────────────────────────────────────────────────────

function RaiseModal({ assets, onClose, onRaised }) {
  const [assetId, setAssetId] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assetId || !issue.trim()) return toast.error('Asset and issue description are required');
    setLoading(true);
    try {
      await api.post('/maintenance', { assetId, issue, priority });
      toast.success('Maintenance request raised');
      onRaised();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-md animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">Raise Maintenance Request</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="af-label">Asset *</label>
            <select className="af-select" value={assetId} onChange={e => setAssetId(e.target.value)}>
              <option value="">Select asset…</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="af-label">Issue Description *</label>
            <textarea
              className="af-input min-h-24 resize-none"
              placeholder="Describe the problem in detail…"
              value={issue}
              onChange={e => setIssue(e.target.value)}
            />
          </div>
          <div>
            <label className="af-label">Priority</label>
            <div className="flex gap-2">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'badge cursor-pointer transition-all',
                    PRIORITY_COLORS[p],
                    priority === p ? 'ring-2 ring-offset-2 ring-offset-card ring-current scale-105' : 'opacity-60 hover:opacity-80'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Maintenance() {
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRaise, setShowRaise] = useState(false);
  const [processing, setProcessing] = useState(null);
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, aRes] = await Promise.all([
        api.get('/maintenance'),
        api.get('/assets'),
      ]);
      setRequests(mRes.data);
      setAssets(aRes.data);
    } catch { toast.error('Failed to load maintenance data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAction = async (id, action) => {
    setProcessing(id);
    try {
      const endpoints = {
        approve:  `/maintenance/${id}/approve`,
        reject:   `/maintenance/${id}/reject`,
        assign:   `/maintenance/${id}/assign`,
        progress: `/maintenance/${id}/progress`,
        resolve:  `/maintenance/${id}/resolve`,
      };
      const body = action === 'assign' ? { technicianId: user.id } : {};
      await api.put(endpoints[action], body);
      toast.success(`Request ${action}d`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally { setProcessing(null); }
  };

  // Note from mockup: "Approving a card moves the asset to under maintenance; resolving it returns to available"
  const byStatus = (status) => requests.filter(r => r.status === status);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Maintenance Management</h2>
          <p className="page-subtitle">
            {requests.filter(r => r.status !== 'RESOLVED' && r.status !== 'REJECTED').length} open ·
            Approving moves asset to maintenance; resolving returns it to available
          </p>
        </div>
        <button onClick={() => setShowRaise(true)} className="btn-primary">
          <Plus size={14} /> Raise Request
        </button>
      </div>

      {/* Kanban board — Screen 7 */}
      {loading ? (
        <div className="flex gap-4">
          {COLUMNS.map(c => (
            <div key={c.key} className="flex-1 space-y-2">
              <div className="h-9 bg-secondary rounded-lg animate-shimmer" />
              <div className="h-24 bg-secondary/50 rounded-lg animate-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.key}
              column={col}
              requests={byStatus(col.key)}
              canManage={canManage}
              onAction={handleAction}
              processing={processing}
            />
          ))}
        </div>
      )}

      {/* Rejected */}
      {requests.filter(r => r.status === 'REJECTED').length > 0 && (
        <div className="section-card">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rejected</h4>
          <div className="space-y-2">
            {requests.filter(r => r.status === 'REJECTED').map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border text-sm">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{r.asset?.tag}</span>
                  <span className="ml-2 text-foreground">{r.issue?.slice(0, 60)}{r.issue?.length > 60 && '…'}</span>
                </div>
                <span className="badge badge-rejected">Rejected</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRaise && (
        <RaiseModal assets={assets} onClose={() => setShowRaise(false)} onRaised={fetchAll} />
      )}
    </div>
  );
}
