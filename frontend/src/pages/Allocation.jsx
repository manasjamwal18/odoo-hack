import { useEffect, useState, useCallback } from 'react';
import { ArrowLeftRight, RotateCcw, AlertTriangle, Loader2, X, Check } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDate, isOverdue } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

// ── Conflict Banner (Screen 5 key feature) ────────────────────────────────────

function ConflictBanner({ conflict }) {
  if (!conflict) return null;
  return (
    <div className="alert-strip alert-strip-danger animate-slide-up">
      <AlertTriangle size={16} className="shrink-0" />
      <div>
        <p className="font-semibold">Already allocated — double-allocation blocked</p>
        <p className="text-xs mt-0.5 opacity-80">
          Held by <strong>{conflict.heldBy?.name || conflict.heldBy?.email}</strong>.
          Submit a transfer request below to move it.
        </p>
      </div>
    </div>
  );
}

// ── Allocate Form ─────────────────────────────────────────────────────────────

function AllocateForm({ assets, employees, onDone }) {
  const [assetId, setAssetId] = useState('');
  const [userId, setUserId] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [conflict, setConflict] = useState(null);
  const [conflictAlloc, setConflictAlloc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [filteredAssets, setFilteredAssets] = useState([]);

  useEffect(() => {
    if (!assetSearch.trim()) { setFilteredAssets([]); return; }
    setFilteredAssets(
      assets.filter(a =>
        a.tag.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(assetSearch.toLowerCase())
      ).slice(0, 8)
    );
  }, [assetSearch, assets]);

  const selectAsset = (a) => {
    setAssetId(a.id);
    setAssetSearch(`${a.tag} — ${a.name}`);
    setFilteredAssets([]);
    setConflict(null);
    setConflictAlloc(null);
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    if (!assetId || !userId) return toast.error('Select an asset and employee');
    setLoading(true);
    try {
      await api.post('/allocations', {
        assetId, userId,
        expectedReturnDate: returnDate || undefined,
      });
      toast.success('Asset allocated successfully');
      setAssetId(''); setUserId(''); setReturnDate('');
      setAssetSearch(''); setConflict(null); setConflictAlloc(null);
      onDone();
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data);
        setConflictAlloc(err.response.data.allocationId);
      } else {
        toast.error(err.response?.data?.error || 'Allocation failed');
      }
    } finally { setLoading(false); }
  };

  const handleTransferRequest = async () => {
    if (!conflictAlloc || !userId) return toast.error('Select target employee first');
    setLoading(true);
    try {
      await api.post('/allocations/transfer', { allocationId: conflictAlloc, toUserId: userId });
      toast.success('Transfer request submitted');
      setConflict(null); setConflictAlloc(null);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="section-card space-y-4">
      <h3 className="text-sm font-semibold text-foreground">New Allocation</h3>

      {/* Conflict banner — Screen 5 red warning */}
      <ConflictBanner conflict={conflict} />

      <form onSubmit={handleAllocate} className="space-y-4">
        {/* Asset search — typeahead */}
        <div>
          <label className="af-label">Asset (Tag or Name)</label>
          <div className="relative">
            <input
              className="af-input"
              placeholder="Search AF-0114 or Dell Laptop…"
              value={assetSearch}
              onChange={e => { setAssetSearch(e.target.value); setAssetId(''); setConflict(null); }}
            />
            {filteredAssets.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-card-hover z-20 overflow-hidden">
                {filteredAssets.map(a => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => selectAsset(a)}
                    className="w-full text-left px-4 py-2.5 hover:bg-secondary flex items-center justify-between text-sm cursor-pointer"
                  >
                    <span><span className="font-mono text-primary text-xs">{a.tag}</span> — {a.name}</span>
                    <span className={cn('badge ml-2', a.status === 'AVAILABLE' ? 'badge-available' : 'badge-allocated')}>
                      {a.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* From (current holder) */}
          <div>
            <label className="af-label">From (Current)</label>
            <input className="af-input bg-muted/30 text-muted-foreground" readOnly
              value={conflict?.heldBy?.name || (assetId ? 'Available' : '—')} />
          </div>

          {/* To (new holder) */}
          <div>
            <label className="af-label">To — Select Employee</label>
            <select className="af-select" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">Select Employee…</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.department?.name || 'No dept'})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="af-label">Expected Return Date (optional)</label>
          <input type="date" className="af-input" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
        </div>

        <div className="flex gap-3">
          {conflict ? (
            <button
              type="button"
              onClick={handleTransferRequest}
              disabled={!userId || loading}
              className="btn-primary flex-1"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
              Submit Transfer Request
            </button>
          ) : (
            <button type="submit" disabled={!assetId || !userId || loading} className="btn-primary flex-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Allocate Asset
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Allocation History Table ──────────────────────────────────────────────────

function AllocationHistory({ allocations, onRefresh, canManage }) {
  const [returning, setReturning] = useState(null);
  const [returnNotesAllocId, setReturnNotesAllocId] = useState(null);
  const [conditionNotes, setConditionNotes] = useState('');

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setReturning(returnNotesAllocId);
    try {
      await api.put(`/allocations/${returnNotesAllocId}/return`, { conditionNotes });
      toast.success('Asset returned successfully');
      setReturnNotesAllocId(null);
      setConditionNotes('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Return failed');
    } finally { setReturning(null); }
  };

  return (
    <>
      <div className="af-table-wrapper">
        <table className="af-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Allocated To</th>
              <th>Date</th>
              <th>Expected Return</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No allocations found</td></tr>
            ) : allocations.map(a => (
              <tr key={a.id}>
                <td>
                  <div>
                    <span className="font-mono text-xs text-primary font-semibold">{a.asset?.tag}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.asset?.name}</p>
                  </div>
                </td>
                <td className="font-medium">{a.user?.name}</td>
                <td className="text-muted-foreground text-xs">{formatDate(a.createdAt)}</td>
                <td>
                  {a.expectedReturnDate ? (
                    <span className={cn(
                      'text-xs font-medium',
                      isOverdue(a.expectedReturnDate) && a.status === 'ACTIVE'
                        ? 'text-red-400 font-semibold'
                        : 'text-muted-foreground'
                    )}>
                      {isOverdue(a.expectedReturnDate) && a.status === 'ACTIVE' && '⚠ '}
                      {formatDate(a.expectedReturnDate)}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td>
                  <span className={cn('badge', a.status === 'ACTIVE' ? 'badge-allocated' : a.status === 'RETURNED' ? 'badge-available' : 'badge-retired')}>
                    {a.status}
                  </span>
                </td>
                {canManage && (
                  <td>
                    {a.status === 'ACTIVE' && (
                      <button
                        onClick={() => { setReturnNotesAllocId(a.id); setConditionNotes(''); }}
                        disabled={returning === a.id}
                        className="btn-secondary btn-sm flex items-center gap-1.5"
                      >
                        <RotateCcw size={11} />
                        Return
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returnNotesAllocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReturnNotesAllocId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-card-hover animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Return Asset</h3>
              <button onClick={() => setReturnNotesAllocId(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              <div>
                <label className="af-label">Condition & Return Notes</label>
                <textarea
                  className="af-input min-h-24 resize-none"
                  placeholder="e.g. Returned in good condition, minor scratches on the back..."
                  value={conditionNotes}
                  onChange={e => setConditionNotes(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2 border-t border-border">
                <button type="button" onClick={() => setReturnNotesAllocId(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={returning === returnNotesAllocId} className="btn-primary flex-1">
                  {returning === returnNotesAllocId ? <><Loader2 size={14} className="animate-spin" /> Returning…</> : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Transfer Requests Panel ───────────────────────────────────────────────────

function TransferRequests({ transfers, onRefresh, canApprove }) {
  const [processing, setProcessing] = useState(null);

  const decide = async (id, action) => {
    setProcessing(id);
    try {
      await api.put(`/allocations/transfer/${id}/${action}`);
      toast.success(`Transfer ${action}d`);
      onRefresh();
    } catch { toast.error('Action failed'); }
    finally { setProcessing(null); }
  };

  if (!transfers.length) return (
    <div className="empty-state py-8">
      <div className="empty-state-icon"><ArrowLeftRight size={18} className="text-muted-foreground" /></div>
      <p className="text-sm text-muted-foreground">No pending transfer requests</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {transfers.map(t => (
        <div key={t.id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border">
          <div className="text-sm">
            <span className="font-mono text-primary text-xs font-semibold">
              {t.allocation?.asset?.tag}
            </span>
            <span className="text-muted-foreground ml-2 text-xs">
              → {t.toUser?.name}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Requested by {t.requestedBy?.name || 'Employee'}
            </p>
          </div>
          {canApprove ? (
            <div className="flex gap-2">
              <button
                onClick={() => decide(t.id, 'approve')}
                disabled={!!processing}
                className="btn-primary btn-sm"
              >
                {processing === t.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Approve
              </button>
              <button onClick={() => decide(t.id, 'reject')} disabled={!!processing} className="btn-danger btn-sm">
                <X size={11} /> Reject
              </button>
            </div>
          ) : (
            <span className="badge badge-medium">Pending</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Allocation() {
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'].includes(user?.role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, assetRes, empRes] = await Promise.all([
        api.get('/allocations'),
        api.get('/assets'),
        api.get('/org/employees'),
      ]);
      setAllocations(allocRes.data);
      setAssets(assetRes.data);
      setEmployees(empRes.data);

      // Extract pending transfers from allocation data
      const pending = allocRes.data.flatMap(a =>
        (a.transferRequests || []).filter(t => t.status === 'PENDING').map(t => ({
          ...t,
          allocation: a,
        }))
      );
      setTransfers(pending);
    } catch { toast.error('Failed to load allocation data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeAllocations = allocations.filter(a => a.status === 'ACTIVE');
  const historyAllocations = allocations.filter(a => a.status !== 'ACTIVE');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Allocation & Transfer</h2>
          <p className="page-subtitle">
            {activeAllocations.length} active · {transfers.length} pending transfers
          </p>
        </div>
      </div>

      {/* Allocate form — top section matching mockup */}
      {canManage && (
        <AllocateForm assets={assets} employees={employees} onDone={fetchAll} />
      )}

      {/* Tabs: Active | History | Transfers */}
      <div className="tab-list w-fit">
        {[
          { key: 'active',    label: 'Active',    count: activeAllocations.length },
          { key: 'history',   label: 'History',   count: historyAllocations.length },
          { key: 'transfers', label: 'Transfers',  count: transfers.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('tab-btn', tab === t.key && 'tab-btn-active')}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                tab === t.key ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="section-card">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-secondary rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : (
          <>
            {tab === 'active'    && <AllocationHistory allocations={activeAllocations}  onRefresh={fetchAll} canManage={canManage} />}
            {tab === 'history'   && <AllocationHistory allocations={historyAllocations} onRefresh={fetchAll} canManage={false} />}
            {tab === 'transfers' && <TransferRequests  transfers={transfers}             onRefresh={fetchAll} canApprove={canManage} />}
          </>
        )}
      </div>
    </div>
  );
}
