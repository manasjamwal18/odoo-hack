import { useEffect, useState, useCallback } from 'react';
import { Plus, Building2, Tag, Users, Edit2, Trash2, Check, X, ChevronRight, Loader2 } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn, formatDate } from '../lib/utils';

// ── Reusable small components ─────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, children, count }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer',
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

function InlineForm({ fields, onSave, onCancel, loading }) {
  const [vals, setVals] = useState(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? '' }), {})
  );
  return (
    <tr className="bg-secondary/20 animate-slide-up">
      {fields.map(f => (
        <td key={f.key} className="px-4 py-2">
          {f.type === 'select' ? (
            <select
              value={vals[f.key]}
              onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
              className="af-select text-sm py-1.5"
            >
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type={f.type || 'text'}
              placeholder={f.placeholder}
              value={vals[f.key]}
              onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
              className="af-input text-sm py-1.5"
            />
          )}
        </td>
      ))}
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button onClick={() => onSave(vals)} disabled={loading} className="btn-primary btn-sm" aria-label="Save">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
          </button>
          <button onClick={onCancel} className="btn-ghost btn-sm" aria-label="Cancel">
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── DEPARTMENTS TAB ────────────────────────────────────────────────────────────

function DepartmentsTab({ employees }) {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDepts = useCallback(async () => {
    try { const { data } = await api.get('/org/departments'); setDepts(data); }
    catch { toast.error('Failed to load departments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const handleAdd = async (vals) => {
    if (!vals.name.trim()) return toast.error('Department name is required');
    setSaving(true);
    try {
      const headId = employees.find(e => e.name === vals.headId)?.id || vals.headId || undefined;
      await api.post('/org/departments', { name: vals.name, status: vals.status, headId: headId || undefined });
      toast.success('Department added');
      setAdding(false);
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
    } catch { toast.error('Update failed'); }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
          <Plus size={13} /> Add Department
        </button>
      </div>
      <div className="af-table-wrapper">
        <table className="af-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Head</th>
              <th>Parent Dept</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <InlineForm
                loading={saving}
                onCancel={() => setAdding(false)}
                onSave={handleAdd}
                fields={[
                  { key: 'name', placeholder: 'Dept name' },
                  { key: 'headId', placeholder: 'Head (optional)' },
                  { key: 'parentId', placeholder: 'Parent (optional)' },
                  {
                    key: 'status', type: 'select', default: 'ACTIVE',
                    options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]
                  },
                ]}
              />
            )}
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : depts.map(d => (
              <tr key={d.id}>
                <td className="font-medium">{d.name}</td>
                <td className="text-muted-foreground">
                  {employees.find(e => e.id === d.headId)?.name || (d.headId ? '—' : <span className="text-muted-foreground/50 italic">edit: none</span>)}
                </td>
                <td className="text-muted-foreground">{d.parentId || '—'}</td>
                <td>
                  <span className={cn('badge', d.status === 'ACTIVE' ? 'badge-available' : 'badge-retired')}>
                    {d.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus(d)}
                    className={cn('text-xs font-medium cursor-pointer transition-colors',
                      d.status === 'ACTIVE' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                    )}
                  >
                    {d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CATEGORIES TAB ─────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchCats = useCallback(async () => {
    try { const { data } = await api.get('/org/categories'); setCats(data); }
    catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  const handleAdd = async (vals) => {
    if (!vals.name.trim()) return toast.error('Category name is required');
    setSaving(true);
    try {
      await api.post('/org/categories', {
        name: vals.name,
        warrantyMonths: vals.warrantyMonths ? parseInt(vals.warrantyMonths) : undefined,
      });
      toast.success('Category added');
      setAdding(false);
      fetchCats();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
          <Plus size={13} /> Add Category
        </button>
      </div>
      <div className="af-table-wrapper">
        <table className="af-table">
          <thead><tr><th>Category</th><th>Warranty (months)</th><th>Assets</th></tr></thead>
          <tbody>
            {adding && (
              <InlineForm
                loading={saving}
                onCancel={() => setAdding(false)}
                onSave={handleAdd}
                fields={[
                  { key: 'name', placeholder: 'e.g. Electronics' },
                  { key: 'warrantyMonths', type: 'number', placeholder: '24' },
                  { key: '_', placeholder: '—', default: '' },
                ]}
              />
            )}
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-muted-foreground">{c.warrantyMonths ? `${c.warrantyMonths} mo` : '—'}</td>
                <td className="text-muted-foreground">{c._count?.assets ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── EMPLOYEES TAB ──────────────────────────────────────────────────────────────

function EmployeesTab({ employees, onRefresh }) {
  const [promoting, setPromoting] = useState(null);
  const [newRole, setNewRole] = useState('');

  const roles = ['EMPLOYEE', 'DEPT_HEAD', 'ASSET_MANAGER'];
  const roleColors = {
    ADMIN: 'badge-admin', ASSET_MANAGER: 'badge-manager',
    DEPT_HEAD: 'badge-head', EMPLOYEE: 'badge-employee',
  };

  const handlePromote = async (userId) => {
    if (!newRole) return;
    try {
      await api.put(`/org/employees/${userId}/promote`, { role: newRole });
      toast.success('Role updated');
      setPromoting(null);
      onRefresh();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const toggleStatus = async (emp) => {
    const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/org/employees/${emp.id}/status`, { status: newStatus });
      toast.success('Status updated');
      onRefresh();
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="af-table-wrapper">
      <table className="af-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {emp.name?.charAt(0)}
                  </div>
                  <span className="font-medium">{emp.name}</span>
                </div>
              </td>
              <td className="text-muted-foreground text-xs">{emp.email}</td>
              <td className="text-muted-foreground">{emp.department?.name || '—'}</td>
              <td>
                {promoting === emp.id ? (
                  <div className="flex gap-1 items-center">
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      className="af-select text-xs py-1"
                    >
                      <option value="">Select role</option>
                      {roles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                    <button onClick={() => handlePromote(emp.id)} className="text-emerald-400 hover:text-emerald-300 cursor-pointer">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setPromoting(null)} className="text-muted-foreground cursor-pointer">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <span className={cn('badge', roleColors[emp.role])}>{emp.role?.replace(/_/g, ' ')}</span>
                )}
              </td>
              <td>
                <span className={cn('badge', emp.status === 'ACTIVE' ? 'badge-available' : 'badge-retired')}>
                  {emp.status}
                </span>
              </td>
              <td>
                <div className="flex gap-3 items-center">
                  {emp.role !== 'ADMIN' && (
                    <button
                      onClick={() => { setPromoting(emp.id); setNewRole(emp.role); }}
                      className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      Promote
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(emp)}
                    className={cn('text-xs cursor-pointer transition-colors',
                      emp.status === 'ACTIVE' ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                    )}
                  >
                    {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [empLoading, setEmpLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try { const { data } = await api.get('/org/employees'); setEmployees(data); }
    catch { toast.error('Failed to load employees'); }
    finally { setEmpLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

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
        <ChevronRight size={14} />
        <span className="text-xs">Adding a department here also drives the pickers in Asset Registration and Allocation screens.</span>
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
        {tab === 'employees'   && <EmployeesTab employees={employees} onRefresh={fetchEmployees} />}
      </div>
    </div>
  );
}
