import { useEffect, useState, useCallback } from 'react';
import { Plus, Building2, Tag, Users, Edit2, Check, X, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

// ── Shared: Tab Button ─────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, children, count }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer select-none',
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon size={14} />
      {children}
      {count !== undefined && (
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
          active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
        )}>{count}</span>
      )}
    </button>
  );
}

// ── Shared: Edit/Add Dialog ────────────────────────────────────────────────────

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-card-hover animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── DEPARTMENTS TAB ────────────────────────────────────────────────────────────

function DepartmentsTab({ employees }) {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // null | { mode: 'add'|'edit', dept? }
  const [form, setForm] = useState({ name: '', headId: '', parentId: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);

  const fetchDepts = useCallback(async () => {
    try { const { data } = await api.get('/org/departments'); setDepts(data); }
    catch { toast.error('Failed to load departments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const openAdd = () => {
    setForm({ name: '', headId: '', parentId: '', status: 'ACTIVE' });
    setDialog({ mode: 'add' });
  };

  const openEdit = (dept) => {
    setForm({ name: dept.name, headId: dept.headId || '', parentId: dept.parentId || '', status: dept.status });
    setDialog({ mode: 'edit', dept });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Department name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        headId: form.headId || null,
        parentId: form.parentId || null,
        status: form.status,
      };
      if (dialog.mode === 'add') {
        await api.post('/org/departments', payload);
        toast.success('Department added');
      } else {
        await api.put(`/org/departments/${dialog.dept.id}`, payload);
        toast.success('Department updated');
      }
      setDialog(null);
      fetchDepts();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (dept) => {
    const newStatus = dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/org/departments/${dept.id}`, { status: newStatus });
      setDepts(d => d.map(x => x.id === dept.id ? { ...x, status: newStatus } : x));
      toast.success(`Department ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  const heads = employees.filter(e => ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'].includes(e.role));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="btn-primary btn-sm">
          <Plus size={13} /> Add Department
        </button>
      </div>

      <div className="af-table-wrapper">
        <table className="af-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Head</th>
              <th>Employees</th>
              <th>Assets</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-shimmer" /></td>)}</tr>
              ))
            ) : depts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No departments yet — add one above</td></tr>
            ) : depts.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td className="text-muted-foreground text-sm">
                  {employees.find(e => e.id === d.headId)?.name || <span className="italic text-muted-foreground/50">None</span>}
                </td>
                <td className="text-muted-foreground">{d._count?.employees ?? d.employees?.length ?? '—'}</td>
                <td className="text-muted-foreground">{d._count?.assets ?? '—'}</td>
                <td>
                  <span className={cn('badge', d.status === 'ACTIVE' ? 'badge-available' : 'badge-retired')}>
                    {d.status}
                  </span>
                </td>
                <td>
                  <div className="flex gap-3 items-center">
                    <button onClick={() => openEdit(d)} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(d)}
                      className={cn('text-xs cursor-pointer transition-colors',
                        d.status === 'ACTIVE' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                      )}
                    >
                      {d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <Dialog
          title={dialog.mode === 'add' ? 'Add Department' : `Edit — ${dialog.dept.name}`}
          onClose={() => setDialog(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="af-label">Department Name *</label>
              <input
                className="af-input" autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Engineering"
              />
            </div>
            <div>
              <label className="af-label">Head of Department</label>
              <select className="af-select" value={form.headId} onChange={e => setForm(f => ({ ...f, headId: e.target.value }))}>
                <option value="">None</option>
                {heads.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="af-label">Parent Department</label>
              <select className="af-select" value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">None (top-level)</option>
                {depts.filter(d => d.id !== dialog.dept?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="af-label">Status</label>
              <select className="af-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setDialog(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {dialog.mode === 'add' ? 'Add Department' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── CATEGORIES TAB ─────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ name: '', warrantyMonths: '' });
  const [saving, setSaving] = useState(false);

  const fetchCats = useCallback(async () => {
    try { const { data } = await api.get('/org/categories'); setCats(data); }
    catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  const openAdd = () => { setForm({ name: '', warrantyMonths: '' }); setDialog({ mode: 'add' }); };
  const openEdit = (c) => { setForm({ name: c.name, warrantyMonths: c.warrantyMonths ?? '' }); setDialog({ mode: 'edit', cat: c }); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Category name is required');
    setSaving(true);
    try {
      const payload = { name: form.name, warrantyMonths: form.warrantyMonths ? parseInt(form.warrantyMonths) : null };
      if (dialog.mode === 'add') {
        await api.post('/org/categories', payload);
        toast.success('Category added');
      } else {
        await api.put(`/org/categories/${dialog.cat.id}`, payload);
        toast.success('Category updated');
      }
      setDialog(null);
      fetchCats();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd} className="btn-primary btn-sm">
          <Plus size={13} /> Add Category
        </button>
      </div>

      <div className="af-table-wrapper">
        <table className="af-table">
          <thead><tr><th>Category</th><th>Warranty (months)</th><th>Assets</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>{[...Array(4)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-shimmer" /></td>)}</tr>
              ))
            ) : cats.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No categories yet</td></tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-muted-foreground">{c.warrantyMonths ? `${c.warrantyMonths} months` : '—'}</td>
                <td className="text-muted-foreground">{c._count?.assets ?? '—'}</td>
                <td>
                  <button onClick={() => openEdit(c)} className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                    <Edit2 size={11} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <Dialog
          title={dialog.mode === 'add' ? 'Add Category' : `Edit — ${dialog.cat.name}`}
          onClose={() => setDialog(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="af-label">Category Name *</label>
              <input
                className="af-input" autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Electronics"
              />
            </div>
            <div>
              <label className="af-label">Warranty Period (months)</label>
              <input
                type="number" min="0" className="af-input"
                value={form.warrantyMonths}
                onChange={e => setForm(f => ({ ...f, warrantyMonths: e.target.value }))}
                placeholder="e.g. 24"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank if no standard warranty applies</p>
            </div>
            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setDialog(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {dialog.mode === 'add' ? 'Add Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── EMPLOYEES TAB ──────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  ADMIN: 'badge-admin', ASSET_MANAGER: 'badge-manager',
  DEPT_HEAD: 'badge-head', EMPLOYEE: 'badge-employee',
};

function EmployeesTab({ employees, departments, onRefresh }) {
  const [dialog, setDialog] = useState(null); // null | { emp }
  const [form, setForm] = useState({ role: '', departmentId: '', status: '' });
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuthStore();

  const openEdit = (emp) => {
    setForm({ role: emp.role, departmentId: emp.departmentId || '', status: emp.status });
    setDialog({ emp });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Promote if role changed
      if (form.role !== dialog.emp.role) {
        await api.put(`/org/employees/${dialog.emp.id}/promote`, { role: form.role });
      }
      // Update dept + status
      await api.put(`/org/employees/${dialog.emp.id}`, {
        departmentId: form.departmentId || null,
        status: form.status,
      });
      toast.success('Employee updated');
      setDialog(null);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const [search, setSearch] = useState('');
  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="search"
          className="af-input max-w-64"
          placeholder="Search employees…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground shrink-0">{filtered.length} of {employees.length} employees</span>
      </div>

      <div className="af-table-wrapper">
        <table className="af-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No employees found</td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                      {emp.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{emp.name}</p>
                      {emp.id === currentUser?.id && (
                        <span className="text-[10px] text-primary font-semibold">You</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-muted-foreground text-xs">{emp.email}</td>
                <td className="text-muted-foreground">{emp.department?.name || <span className="italic text-muted-foreground/40">Unassigned</span>}</td>
                <td><span className={cn('badge', ROLE_COLORS[emp.role])}>{emp.role?.replace(/_/g, ' ')}</span></td>
                <td>
                  <span className={cn('badge', emp.status === 'ACTIVE' ? 'badge-available' : 'badge-retired')}>
                    {emp.status}
                  </span>
                </td>
                <td>
                  {emp.role !== 'ADMIN' && (
                    <button
                      onClick={() => openEdit(emp)}
                      className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <Dialog title={`Edit — ${dialog.emp.name}`} onClose={() => setDialog(null)}>
          <div className="space-y-4">
            {/* Current info */}
            <div className="p-3 bg-secondary/40 rounded-lg border border-border text-sm">
              <p className="font-medium text-foreground">{dialog.emp.name}</p>
              <p className="text-xs text-muted-foreground">{dialog.emp.email}</p>
            </div>

            <div>
              <label className="af-label">Role</label>
              <select className="af-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="EMPLOYEE">Employee</option>
                <option value="DEPT_HEAD">Dept Head</option>
                <option value="ASSET_MANAGER">Asset Manager</option>
              </select>
              {form.role !== dialog.emp.role && (
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> Role will change from {dialog.emp.role.replace(/_/g, ' ')} → {form.role.replace(/_/g, ' ')}
                </p>
              )}
            </div>

            <div>
              <label className="af-label">Department</label>
              <select className="af-select" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
                <option value="">Unassigned</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="af-label">Status</label>
              <select className="af-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => setDialog(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── Access Denied (non-admin) ──────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="empty-state py-20">
      <div className="empty-state-icon bg-red-500/10">
        <AlertCircle size={22} className="text-red-400" />
      </div>
      <p className="text-base font-semibold text-foreground">Access Denied</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
        Organization Setup is restricted to Admin accounts only.
        Contact your admin to make changes.
      </p>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'categories',  label: 'Categories',  icon: Tag },
  { key: 'employees',   label: 'Employees',   icon: Users },
];

export default function OrgSetup() {
  const [tab, setTab] = useState('departments');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const { user } = useAuthStore();

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const [eRes, dRes] = await Promise.all([api.get('/org/employees'), api.get('/org/departments')]);
      setEmployees(eRes.data);
      setDepartments(dRes.data);
    } catch { toast.error('Failed to load employee data'); }
    finally { setEmpLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Non-admin gets access denied
  if (user?.role !== 'ADMIN') return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Organization Setup</h2>
      </div>
      <div className="section-card"><AccessDenied /></div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Organization Setup</h2>
          <p className="page-subtitle">Manage departments, asset categories, and employee roles</p>
        </div>
      </div>

      {/* Info note from mockup */}
      <div className="alert-strip alert-strip-info">
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-xs">
          Adding a department here also drives the pickers in Asset Registration and Allocation screens.
        </span>
      </div>

      {/* Tabs */}
      <div className="tab-list w-fit">
        {TABS.map(t => (
          <TabButton
            key={t.key}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
            icon={t.icon}
            count={t.key === 'employees' ? employees.length : undefined}
          >
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* Tab content */}
      <div className="section-card">
        {tab === 'departments' && <DepartmentsTab employees={employees} />}
        {tab === 'categories'  && <CategoriesTab />}
        {tab === 'employees'   && (
          empLoading
            ? <div className="h-48 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            : <EmployeesTab employees={employees} departments={departments} onRefresh={fetchEmployees} />
        )}
      </div>
    </div>
  );
}
