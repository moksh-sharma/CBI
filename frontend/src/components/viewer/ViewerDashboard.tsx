import { Routes, Route, Navigate } from 'react-router';
import type { User } from '../../contexts/AuthContext';
import ViewerLayout from './ViewerLayout';
import ViewerHome from './ViewerHome';
import InteractiveDashboard from './InteractiveDashboard';

interface ViewerDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function ViewerDashboard({ user, onLogout }: ViewerDashboardProps) {
  return (
    <ViewerLayout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/viewer/dashboard" replace />} />
        <Route path="/dashboard" element={<ViewerHome />} />
        <Route path="/view/:id" element={<InteractiveDashboard />} />
      </Routes>
    </ViewerLayout>
  );
}