import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { useAuth } from './contexts/AuthContext';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import DeveloperLogin from './components/developer/DeveloperLogin';
import DeveloperDashboard from './components/developer/DeveloperDashboard';
import ViewerLogin from './components/viewer/ViewerLogin';
import ViewerDashboard from './components/viewer/ViewerDashboard';
import LandingPage from './components/LandingPage';

function RoleRedirect({ role }: { role: string }) {
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (role === 'developer') return <Navigate to="/developer/dashboard" replace />;
  if (role === 'viewer') return <Navigate to="/viewer/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Admin */}
        <Route
          path="/admin/login"
          element={
            user?.role_name === 'admin' ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <AdminLogin />
            )
          }
        />
        <Route
          path="/admin/*"
          element={
            !user ? (
              <Navigate to="/admin/login" replace />
            ) : user.role_name !== 'admin' ? (
              <RoleRedirect role={user.role_name} />
            ) : (
              <AdminDashboard user={user} onLogout={logout} />
            )
          }
        />

        {/* Developer */}
        <Route
          path="/developer/login"
          element={
            user?.role_name === 'developer' ? (
              <Navigate to="/developer/dashboard" replace />
            ) : (
              <DeveloperLogin />
            )
          }
        />
        <Route
          path="/developer/*"
          element={
            !user ? (
              <Navigate to="/developer/login" replace />
            ) : user.role_name !== 'developer' ? (
              <RoleRedirect role={user.role_name} />
            ) : (
              <DeveloperDashboard user={user} onLogout={logout} />
            )
          }
        />

        {/* Viewer */}
        <Route
          path="/viewer/login"
          element={
            user?.role_name === 'viewer' ? (
              <Navigate to="/viewer/dashboard" replace />
            ) : (
              <ViewerLogin />
            )
          }
        />
        <Route
          path="/viewer/*"
          element={
            !user ? (
              <Navigate to="/viewer/login" replace />
            ) : user.role_name !== 'viewer' ? (
              <RoleRedirect role={user.role_name} />
            ) : (
              <ViewerDashboard user={user} onLogout={logout} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
