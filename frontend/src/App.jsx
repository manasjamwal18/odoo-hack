import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages (stubs will be replaced in subsequent steps)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrgSetup from './pages/OrgSetup';
import Assets from './pages/Assets';
import Allocation from './pages/Allocation';
import Booking from './pages/Booking';
import Maintenance from './pages/Maintenance';
import Audit from './pages/Audit';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';

// Layout wrapper for authenticated screens
function AppLayout({ title }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(222 47% 11%)',
            color: 'hsl(210 40% 96%)',
            border: '1px solid hsl(217 32% 17%)',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: 'hsl(160 84% 39%)', secondary: 'white' } },
          error:   { iconTheme: { primary: 'hsl(0 72% 51%)',   secondary: 'white' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />} />

        {/* Protected — all authenticated users */}
        <Route element={<ProtectedRoute><AppLayout title="Dashboard" /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
        <Route element={<ProtectedRoute><AppLayout title="Assets" /></ProtectedRoute>}>
          <Route path="/assets" element={<Assets />} />
        </Route>
        <Route element={<ProtectedRoute><AppLayout title="Allocation & Transfer" /></ProtectedRoute>}>
          <Route path="/allocation" element={<Allocation />} />
        </Route>
        <Route element={<ProtectedRoute><AppLayout title="Resource Booking" /></ProtectedRoute>}>
          <Route path="/booking" element={<Booking />} />
        </Route>
        <Route element={<ProtectedRoute><AppLayout title="Maintenance Management" /></ProtectedRoute>}>
          <Route path="/maintenance" element={<Maintenance />} />
        </Route>
        <Route element={<ProtectedRoute><AppLayout title="Notifications" /></ProtectedRoute>}>
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Protected — Admin + Asset Manager only */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']}><AppLayout title="Organization Setup" /></ProtectedRoute>}>
          <Route path="/org-setup" element={<OrgSetup />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN','ASSET_MANAGER']}><AppLayout title="Audit" /></ProtectedRoute>}>
          <Route path="/audit" element={<Audit />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN','ASSET_MANAGER','DEPT_HEAD']}><AppLayout title="Reports & Analytics" /></ProtectedRoute>}>
          <Route path="/reports" element={<Reports />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
