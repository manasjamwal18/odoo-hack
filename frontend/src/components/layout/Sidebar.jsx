import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard, Building2, Package, ArrowLeftRight,
  CalendarRange, Wrench, ClipboardList, BarChart3, Bell,
  LogOut, Shield, UserCog, Users, User
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',     label: 'Dashboard',              icon: LayoutDashboard,  roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
  { to: '/org-setup',     label: 'Organization Setup',     icon: Building2,         roles: ['ADMIN'] },
  { to: '/assets',        label: 'Assets',                 icon: Package,           roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
  { to: '/allocation',    label: 'Allocation & Transfer',  icon: ArrowLeftRight,    roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
  { to: '/booking',       label: 'Resource Booking',       icon: CalendarRange,     roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
  { to: '/maintenance',   label: 'Maintenance',            icon: Wrench,            roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
  { to: '/audit',         label: 'Audit',                  icon: ClipboardList,     roles: ['ADMIN','ASSET_MANAGER'] },
  { to: '/reports',       label: 'Reports',                icon: BarChart3,         roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD'] },
  { to: '/notifications', label: 'Notifications',          icon: Bell,              roles: ['ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE'] },
];

const roleConfig = {
  ADMIN:         { label: 'Admin',         icon: Shield,    className: 'bg-violet-500/15 text-violet-400' },
  ASSET_MANAGER: { label: 'Asset Manager', icon: UserCog,   className: 'bg-blue-500/15 text-blue-400' },
  DEPT_HEAD:     { label: 'Dept Head',     icon: Users,     className: 'bg-emerald-500/15 text-emerald-400' },
  EMPLOYEE:      { label: 'Employee',      icon: User,      className: 'bg-zinc-500/15 text-zinc-400' },
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const role = roleConfig[user?.role] || roleConfig.EMPLOYEE;
  const RoleIcon = role.icon;

  const handleLogout = () => { logout(); navigate('/login'); };
  const visibleItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0 overflow-hidden">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow-sm">
          <span className="text-xs font-bold text-primary-foreground">AF</span>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-none">AssetFlow</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Enterprise ERP</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer select-none',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )
            }
          >
            <Icon size={15} strokeWidth={1.75} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-border space-y-2">
        {/* Role badge */}
        <div className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold', role.className)}>
          <RoleIcon size={11} />
          {role.label}
        </div>
        {/* User info */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        {/* Logout */}
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground
                     hover:bg-destructive/10 hover:text-red-400 transition-colors duration-150 cursor-pointer"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
