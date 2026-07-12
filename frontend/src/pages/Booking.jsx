import { useEffect, useState, useCallback } from 'react';
import { CalendarRange, Clock, Plus, X, AlertTriangle, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDateTime } from '../lib/utils';

// ── Time slot grid (Screen 6 — visual calendar) ───────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM – 7 PM

function TimeGrid({ assetId, bookings, selectedDate }) {
  if (!assetId) return (
    <div className="empty-state py-12">
      <div className="empty-state-icon"><CalendarRange size={20} className="text-muted-foreground" /></div>
      <p className="text-sm text-muted-foreground">Select a bookable resource to see availability</p>
    </div>
  );

  const dayBookings = bookings.filter(b => {
    const start = new Date(b.startTime);
    return (
      start.getFullYear() === selectedDate.getFullYear() &&
      start.getMonth() === selectedDate.getMonth() &&
      start.getDate() === selectedDate.getDate() &&
      b.status !== 'CANCELLED'
    );
  });

  return (
    <div className="space-y-1">
      {HOURS.map(h => {
        const slotStart = new Date(selectedDate);
        slotStart.setHours(h, 0, 0, 0);
        const slotEnd = new Date(selectedDate);
        slotEnd.setHours(h + 1, 0, 0, 0);

        const booking = dayBookings.find(b => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          return bStart < slotEnd && bEnd > slotStart;
        });

        const isPast = slotStart < new Date();

        return (
          <div key={h} className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground w-12 text-right font-mono shrink-0">
              {h < 12 ? `${h}:00` : `${h > 12 ? h - 12 : 12}:00`}{h < 12 ? ' AM' : ' PM'}
            </span>
            <div className={cn(
              'flex-1 h-9 rounded-lg border text-xs flex items-center px-3 font-medium transition-all',
              booking
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : isPast
                  ? 'bg-secondary/30 border-border/30 text-muted-foreground/50'
                  : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer'
            )}>
              {booking ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-400 mr-2 shrink-0" />
                  Booked — {booking.user?.name}
                  {booking.status === 'UPCOMING' && <span className="ml-2 text-[10px] opacity-70">Upcoming</span>}
                </>
              ) : isPast ? (
                <span className="opacity-50">Past</span>
              ) : (
                <span>Available</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Book Slot Form ────────────────────────────────────────────────────────────

function BookSlotForm({ assetId, selectedDate, onBooked }) {
  const [startH, setStartH] = useState('09');
  const [endH, setEndH] = useState('10');
  const [conflict, setConflict] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBook = async () => {
    setConflict(null);
    const start = new Date(selectedDate);
    start.setHours(parseInt(startH), 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(parseInt(endH), 0, 0, 0);

    if (start >= end) return toast.error('End time must be after start time');

    setLoading(true);
    try {
      await api.post('/bookings', { assetId, startTime: start.toISOString(), endTime: end.toISOString() });
      toast.success('Booking confirmed!');
      onBooked();
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data.conflict);
        toast.error('Time conflict — slot unavailable');
      } else {
        toast.error(err.response?.data?.error || 'Booking failed');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <h4 className="text-sm font-semibold text-foreground">Book a Slot</h4>

      {/* Conflict warning — Screen 6: "Requested 4:00 to 10:30 — conflict — slot is unavailable" */}
      {conflict && (
        <div className="alert-strip alert-strip-warning">
          <AlertTriangle size={14} />
          <span className="text-xs">
            Requested {startH}:00 to {endH}:00 — conflict — slot is unavailable
            {conflict.bookedBy && ` (booked by ${conflict.bookedBy})`}
          </span>
        </div>
      )}

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="af-label">From</label>
          <select className="af-select" value={startH} onChange={e => setStartH(e.target.value)}>
            {HOURS.map(h => (
              <option key={h} value={String(h).padStart(2, '0')}>
                {h < 12 ? `${h}:00 AM` : `${h > 12 ? h - 12 : 12}:00 PM`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="af-label">To</label>
          <select className="af-select" value={endH} onChange={e => setEndH(e.target.value)}>
            {HOURS.filter(h => h > parseInt(startH)).map(h => (
              <option key={h} value={String(h).padStart(2, '0')}>
                {h < 12 ? `${h}:00 AM` : `${h > 12 ? h - 12 : 12}:00 PM`}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleBook}
          disabled={loading || !assetId}
          className="btn-primary"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Book a slot
        </button>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function Booking() {
  const [bookableAssets, setBookableAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/assets', { params: { bookable: 'true' } })
      .then(({ data }) => {
        setBookableAssets(data);
        if (data.length > 0) setSelectedAssetId(data[0].id);
      })
      .catch(() => toast.error('Failed to load bookable assets'));
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!selectedAssetId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/bookings', { params: { assetId: selectedAssetId } });
      setBookings(data);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, [selectedAssetId]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const selectedAsset = bookableAssets.find(a => a.id === selectedAssetId);

  const changeDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const dateLabel = selectedDate.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Resource Booking</h2>
          <p className="page-subtitle">Conference rooms, vehicles, shared equipment</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: asset picker + date nav */}
        <div className="space-y-4">
          <div className="section-card space-y-4">
            <div>
              <label className="af-label">Select Resource</label>
              <select
                className="af-select"
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
              >
                <option value="">Choose a resource…</option>
                {bookableAssets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.location || a.tag})</option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="p-3 bg-secondary/40 rounded-lg border border-border text-sm">
                <p className="font-semibold text-foreground">{selectedAsset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedAsset.location}</p>
              </div>
            )}

            {/* Date nav — matches Screen 6 header */}
            <div>
              <label className="af-label">Date</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => changeDate(-1)}
                  className="btn-ghost btn-icon"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                </div>
                <button
                  onClick={() => changeDate(1)}
                  className="btn-ghost btn-icon"
                  aria-label="Next day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <input
                type="date"
                className="af-input mt-2 text-xs"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={e => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
              />
            </div>
          </div>

          {/* My upcoming bookings */}
          <div className="section-card">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Bookings</h4>
            {bookings.filter(b => b.status !== 'CANCELLED').slice(0, 5).map(b => (
              <div key={b.id} className="py-2.5 border-b border-border/50 last:border-0 text-xs">
                <p className="font-medium text-foreground">{b.asset?.name}</p>
                <p className="text-muted-foreground mt-0.5">
                  {new Date(b.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(b.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <span className={cn('badge mt-1',
                  b.status === 'UPCOMING' ? 'badge-allocated' :
                  b.status === 'ONGOING' ? 'badge-available' : 'badge-retired'
                )}>{b.status}</span>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-xs text-muted-foreground">No bookings yet</p>}
          </div>
        </div>

        {/* Right: time grid + booking form */}
        <div className="lg:col-span-2 section-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {selectedAsset ? selectedAsset.name : 'Select a resource'} — {dateLabel}
            </h3>
            {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>

          <TimeGrid assetId={selectedAssetId} bookings={bookings} selectedDate={selectedDate} />

          {selectedAssetId && (
            <BookSlotForm
              assetId={selectedAssetId}
              selectedDate={selectedDate}
              onBooked={fetchBookings}
            />
          )}
        </div>
      </div>
    </div>
  );
}
