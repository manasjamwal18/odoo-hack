import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (mode === 'signup' && !form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const { data } = await api.post(endpoint, payload);
      login(data.user, data.token);
      toast.success(`Welcome${data.user.name ? `, ${data.user.name.split(' ')[0]}` : ''}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong';
      toast.error(msg);
      if (msg.toLowerCase().includes('email')) setErrors(e => ({ ...e, email: msg }));
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('credential'))
        setErrors(e => ({ ...e, password: msg }));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (email) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password: 'test123' });
      login(data.user, data.token);
      toast.success(`Logged in as ${data.user.name}`);
      navigate('/dashboard');
    } catch {
      toast.error('Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-slide-up relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.jpg" 
            alt="AssetFlow" 
            className="h-20 w-auto object-contain mb-4 select-none pointer-events-none" 
            style={{ filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(1.1)', mixBlendMode: 'screen' }}
          />
          <h1 className="text-xl font-bold text-foreground">
            {mode === 'login' ? 'Login' : 'Create Account'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Enterprise Asset & Resource Management</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="af-label">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Priya Shah"
                  value={form.name}
                  onChange={change('name')}
                  className={cn('af-input', errors.name && 'border-destructive/70 focus:ring-destructive/50')}
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="af-label">Email *</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={change('email')}
                className={cn('af-input', errors.email && 'border-destructive/70 focus:ring-destructive/50')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="af-label">Password *</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={change('password')}
                  className={cn('af-input pr-10', errors.password && 'border-destructive/70 focus:ring-destructive/50')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}

              {/* Forgot password */}
              {mode === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => toast('Password reset link sent (demo)', { icon: '📧' })}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Forgot password
                  </button>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="btn-primary w-full mt-2 h-10"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
                : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={15} /></>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">
                {mode === 'login' ? 'New here?' : 'Already have an account?'}
              </span>
            </div>
          </div>

          {mode === 'login' ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-3">
                Sign up creates an employee account — admin roles assigned later
              </p>
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrors({}); }}
                className="btn-secondary w-full h-9 text-sm"
              >
                Create Account
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrors({}); }}
              className="btn-ghost w-full h-9 text-sm"
            >
              Back to Sign In
            </button>
          )}
        </div>

        {/* Demo quick-login */}
        <div className="mt-4 bg-card/50 border border-border/50 rounded-xl p-4 animate-fade-in">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Demo accounts (password: test123)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Admin',         email: 'admin@co.com',   color: 'text-violet-400' },
              { label: 'Asset Manager', email: 'manager@co.com', color: 'text-blue-400' },
              { label: 'Dept Head',     email: 'head@co.com',    color: 'text-emerald-400' },
              { label: 'Employee',      email: 'emp@co.com',     color: 'text-zinc-400' },
            ].map(({ label, email, color }) => (
              <button
                key={email}
                type="button"
                onClick={() => quickLogin(email)}
                disabled={loading}
                className={cn(
                  'text-[11px] font-semibold px-2 py-2 rounded-lg bg-secondary/60 hover:bg-secondary',
                  'border border-border/50 transition-all duration-150 cursor-pointer text-left',
                  color
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
