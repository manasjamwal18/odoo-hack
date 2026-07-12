import { useState, useEffect } from 'react';
import { X, User, ShieldAlert, Key, Check, Laptop, Clock, Bell, Eye, EyeOff, Loader2, Save, Wrench } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';

const TABS = [
  { id: 'account', label: 'Account Info', icon: User },
  { id: 'security', label: 'Security', icon: Key },
  { id: 'preferences', label: 'Preferences', icon: Bell },
  { id: 'quickview', label: 'Quick Views', icon: Laptop },
];

export default function ProfileModal({ onClose }) {
  const { user, login, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('account');
  const [name, setName] = useState(user?.name || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Preferences State
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notifs, setNotifs] = useState({
    general: true,
    bookings: true,
    maintenance: true,
  });

  // Quick Views Data
  const [holdings, setHoldings] = useState([]);
  const [requests, setRequests] = useState({ bookings: [], maintenance: [] });
  const [loadingQuickView, setLoadingQuickView] = useState(false);

  // Fetch holdings and requests on quickview tab mount
  useEffect(() => {
    if (activeTab === 'quickview') {
      setLoadingQuickView(true);
      Promise.all([
        api.get('/allocations'),
        api.get('/bookings'),
        api.get('/maintenance'),
      ]).then(([allocRes, bookRes, maintRes]) => {
        const myAllocations = allocRes.data.filter(a => a.userId === user?.id && a.status === 'ACTIVE');
        const myBookings = bookRes.data.filter(b => b.userId === user?.id && b.status !== 'CANCELLED');
        const myMaint = maintRes.data.filter(m => m.raisedById === user?.id && m.status !== 'RESOLVED' && m.status !== 'REJECTED');
        setHoldings(myAllocations);
        setRequests({ bookings: myBookings, maintenance: myMaint });
      }).catch(() => {
        toast.error('Failed to load quick view data');
      }).finally(() => {
        setLoadingQuickView(false);
      });
    }
  }, [activeTab, user?.id]);

  // Handle Photo Upload (Base64)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return toast.error('Avatar image must be smaller than 2MB');
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Update Profile Name/Photo
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', { name, photoUrl });
      login(data, useAuthStore.getState().token); // Update store user state
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error('All password fields are required');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setSaving(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // Logout All Devices
  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of all sessions?')) return;
    setSaving(true);
    try {
      await api.post('/auth/logout-all');
      toast.success('Logged out of all sessions');
      logout();
      onClose();
      window.location.href = '/login';
    } catch {
      toast.error('Session clearance failed');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Theme
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (newTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // System default
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-2xl h-[75vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">User Profile & Settings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your account information and preferences</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tabs Menu Sidebar */}
          <div className="w-48 border-r border-border bg-secondary/20 p-3 flex flex-col gap-1 shrink-0">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer',
                    activeTab === t.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Form Contents */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Account Info Tab */}
            {activeTab === 'account' && (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  {/* Photo upload / Initials */}
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-full bg-primary/20 border border-border flex items-center justify-center text-xl font-bold text-primary overflow-hidden">
                      {photoUrl ? (
                        <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full text-[10px] text-white font-semibold cursor-pointer transition-opacity">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{name || 'User Profile'}</h4>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="af-label">Full Name</label>
                    <input
                      type="text"
                      className="af-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="af-label">Email (Read-Only)</label>
                    <input type="text" className="af-input opacity-70 cursor-not-allowed" value={user?.email || ''} readOnly />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="af-label">Department (Read-Only)</label>
                      <input
                        type="text"
                        className="af-input opacity-70 cursor-not-allowed"
                        value={user?.department?.name || 'Unassigned'}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="af-label">System Role (Read-Only)</label>
                      <input
                        type="text"
                        className="af-input opacity-70 cursor-not-allowed"
                        value={user?.role || 'EMPLOYEE'}
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={saving} className="btn-primary mt-4">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Changes
                </button>
              </form>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Change Password</h4>
                  <div>
                    <label className="af-label">Current Password</label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="af-input"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="af-label">New Password</label>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="af-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="af-label">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="af-input pr-10"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={saving} className="btn-primary mt-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Update Password
                  </button>
                </form>

                <div className="pt-5 border-t border-border space-y-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Session Management</h4>
                  <p className="text-xs text-muted-foreground">Log out of your AssetFlow account on all other active devices.</p>
                  <button onClick={handleLogoutAll} disabled={saving} className="btn-danger btn-sm">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                    Log out of all devices
                  </button>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-5">
                {/* Theme Toggle */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">App Theme</h4>
                  <div className="flex gap-2 bg-secondary p-0.5 rounded-lg w-fit">
                    {['light', 'dark', 'system'].map(t => (
                      <button
                        key={t}
                        onClick={() => handleThemeChange(t)}
                        className={cn(
                          'px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer capitalize',
                          theme === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications Config */}
                <div className="space-y-3 pt-5 border-t border-border">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Notification Preferences</h4>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={notifs.general}
                        onChange={e => setNotifs(n => ({ ...n, general: e.target.checked }))}
                        className="w-4 h-4 accent-primary cursor-pointer mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">General Organization Updates</p>
                        <p className="text-[10px] text-muted-foreground">Receive company-wide announcements and audit announcements.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={notifs.bookings}
                        onChange={e => setNotifs(n => ({ ...n, bookings: e.target.checked }))}
                        className="w-4 h-4 accent-primary cursor-pointer mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Booking Reminders</p>
                        <p className="text-[10px] text-muted-foreground">Receive upcoming resource reservation confirmation alerts.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        checked={notifs.maintenance}
                        onChange={e => setNotifs(n => ({ ...n, maintenance: e.target.checked }))}
                        className="w-4 h-4 accent-primary cursor-pointer mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Maintenance & Asset Status Changes</p>
                        <p className="text-[10px] text-muted-foreground">Get updates on your active maintenance tickets or resource allocations.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Quickview Tab */}
            {activeTab === 'quickview' && (
              <div className="space-y-5">
                {loadingQuickView ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-muted-foreground" size={24} />
                  </div>
                ) : (
                  <>
                    {/* Holdings */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">My Current Holdings</h4>
                      {holdings.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No assets currently allocated to you.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {holdings.map(h => (
                            <div key={h.id} className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-xs">
                              <div className="flex justify-between font-medium">
                                <span className="text-foreground">{h.asset?.name}</span>
                                <span className="font-mono text-primary text-[10px]">{h.asset?.tag}</span>
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-1">Allocated since: {new Date(h.createdAt).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Active Requests */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Active Requests</h4>
                      
                      {/* Bookings */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Clock size={10} /> Bookings
                        </p>
                        {requests.bookings.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic ml-3.5">No active bookings.</p>
                        ) : (
                          requests.bookings.map(b => (
                            <div key={b.id} className="p-2.5 bg-secondary/20 border border-border/40 rounded-lg text-xs ml-3.5 flex justify-between items-center">
                              <div>
                                <p className="font-medium text-foreground">{b.asset?.name}</p>
                                <p className="text-muted-foreground text-[10px] mt-0.5">
                                  {new Date(b.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                              </div>
                              <span className="badge badge-allocated">{b.status}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Maintenance requests */}
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Wrench size={10} /> Maintenance Tickets
                        </p>
                        {requests.maintenance.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic ml-3.5">No active tickets.</p>
                        ) : (
                          requests.maintenance.map(m => (
                            <div key={m.id} className="p-2.5 bg-secondary/20 border border-border/40 rounded-lg text-xs ml-3.5 flex justify-between items-center">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{m.asset?.name}</p>
                                <p className="text-muted-foreground text-[10px] mt-0.5 truncate">{m.issue}</p>
                              </div>
                              <span className={cn('badge shrink-0 ml-2',
                                m.status === 'PENDING' ? 'badge-pending' :
                                m.status === 'APPROVED' ? 'badge-approved' : 'badge-in-progress'
                              )}>{m.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
