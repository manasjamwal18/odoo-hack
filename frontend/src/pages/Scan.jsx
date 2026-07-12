import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, HelpCircle, Loader2, ArrowLeft, ScanLine } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, getStatusBadgeClass, formatStatus } from '../lib/utils';

// Landed on by scanning an asset's QR label. Shows the asset at a glance and,
// when the asset belongs to an open audit cycle, lets the auditor mark it
// Verified / Damaged / Missing right from their phone.
export default function Scan() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState(null);
  const [marking, setMarking] = useState(null);
  const [marked, setMarked] = useState(null);

  const fetchAsset = () => {
    api.get(`/assets/by-tag/${tag}`)
      .then(({ data }) => setAsset(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load asset'));
  };
  useEffect(fetchAsset, [tag]);

  const auditItem = asset?.auditItems?.[0];
  const holder = asset?.allocations?.[0];

  const mark = async (result) => {
    setMarking(result);
    try {
      await api.put(`/audits/${auditItem.auditCycleId}/items/${auditItem.id}`, { result, notes: `Marked via QR scan` });
      setMarked(result);
      toast.success(`${asset.tag} marked ${result}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record result');
    } finally { setMarking(null); }
  };

  if (error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
      <AlertTriangle size={32} className="text-red-400" />
      <p className="text-foreground font-semibold">{error}</p>
      <p className="text-xs text-muted-foreground font-mono">{tag}</p>
      <button onClick={() => navigate('/assets')} className="btn-secondary btn-sm"><ArrowLeft size={13} /> Asset Directory</button>
    </div>
  );

  if (!asset) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-5 max-w-md mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 text-muted-foreground text-xs pt-2">
        <ScanLine size={14} className="text-primary" />
        Scanned asset
        <button onClick={() => navigate('/assets')} className="ml-auto btn-ghost btn-sm text-xs"><ArrowLeft size={12} /> Directory</button>
      </div>

      <div className="section-card space-y-4">
        {asset.photoUrl && (
          <div className="w-full h-40 rounded-xl overflow-hidden border border-border">
            <img src={asset.photoUrl} alt={asset.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <p className="font-mono text-sm text-primary font-bold">{asset.tag}</p>
          <h1 className="text-xl font-bold text-foreground mt-0.5">{asset.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={cn('badge', getStatusBadgeClass(asset.status))}>{formatStatus(asset.status)}</span>
            {asset.category?.name && <span className="badge badge-retired">{asset.category.name}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Location</p><p className="text-foreground">{asset.location || '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Department</p><p className="text-foreground">{asset.department?.name || '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Condition</p><p className="text-foreground">{asset.condition}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Held by</p><p className="text-foreground">{holder ? (holder.user?.name || `${holder.department?.name} (dept)`) : 'Nobody'}</p></div>
        </div>
      </div>

      {auditItem ? (
        <div className="section-card space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Audit check-in</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Open cycle: <strong>{auditItem.auditCycle?.name}</strong>
              {(marked || auditItem.result) && <span className="ml-2 badge badge-available">currently {marked || auditItem.result}</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => mark('VERIFIED')} disabled={!!marking}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors cursor-pointer">
              {marking === 'VERIFIED' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Verified
            </button>
            <button onClick={() => mark('DAMAGED')} disabled={!!marking}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors cursor-pointer">
              {marking === 'DAMAGED' ? <Loader2 size={18} className="animate-spin" /> : <AlertTriangle size={18} />} Damaged
            </button>
            <button onClick={() => mark('MISSING')} disabled={!!marking}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors cursor-pointer">
              {marking === 'MISSING' ? <Loader2 size={18} className="animate-spin" /> : <HelpCircle size={18} />} Missing
            </button>
          </div>
        </div>
      ) : (
        <div className="section-card">
          <p className="text-xs text-muted-foreground">This asset is not part of any open audit cycle.</p>
        </div>
      )}
    </div>
  );
}
