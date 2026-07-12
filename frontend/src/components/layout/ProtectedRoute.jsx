import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
          <span className="text-3xl">🚫</span>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground text-sm">
          You don't have permission to view this page.
        </p>
        <p className="text-xs text-muted-foreground">
          Required role: {allowedRoles.join(' or ')}
        </p>
      </div>
    );
  }

  return children;
}
