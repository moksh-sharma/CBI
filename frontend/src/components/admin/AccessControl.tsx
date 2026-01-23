import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  UserPlus,
  Loader2,
  X,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_by_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignment_count?: number;
}

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
  role_name: string;
}

interface Assignment {
  id: number;
  dashboard_id: number;
  user_id: number;
  permission_type: 'view' | 'edit';
  user_email: string;
  first_name: string;
  last_name: string;
}

const FEATURES = [
  { id: '1', name: 'Create Dashboards', admin: true, developer: true, viewer: false },
  { id: '2', name: 'Edit Dashboards', admin: true, developer: true, viewer: false },
  { id: '3', name: 'Delete Dashboards', admin: true, developer: false, viewer: false },
  { id: '4', name: 'Manage Users', admin: true, developer: false, viewer: false },
  { id: '5', name: 'Configure Data Sources', admin: true, developer: true, viewer: false },
  { id: '6', name: 'View Analytics', admin: true, developer: true, viewer: true },
  { id: '7', name: 'Export Data', admin: true, developer: true, viewer: true },
  { id: '8', name: 'API Access', admin: true, developer: true, viewer: false },
];

export default function AccessControl() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<{
    dashboardId: number;
    dashboardName: string;
    assignments: Assignment[];
  } | null>(null);
  const [assignUserId, setAssignUserId] = useState<number | ''>('');
  const [assignPermission, setAssignPermission] = useState<'view' | 'edit'>('view');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await apiGet<Dashboard[]>('/api/dashboards');
      if (res.success && res.data)
        setDashboards(Array.isArray(res.data) ? res.data : []);
      else setDashboards([]);
    } catch {
      setDashboards([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiGet<User[]>('/api/users');
      if (res.success && res.data)
        setUsers(Array.isArray(res.data) ? res.data : []);
      else setUsers([]);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchDashboards(), fetchUsers()])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchDashboards, fetchUsers]);

  const openAssignModal = async (d: Dashboard) => {
    setAssignError('');
    setAssignUserId('');
    setAssignPermission('view');
    try {
      const res = await apiGet<Assignment[]>(`/api/dashboards/${d.id}/assignments`);
      const list = (res as { success?: boolean; data?: Assignment[] }).data;
      setAssignModal({
        dashboardId: d.id,
        dashboardName: d.name,
        assignments: Array.isArray(list) ? list : [],
      });
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Failed to load assignments');
      setAssignModal({
        dashboardId: d.id,
        dashboardName: d.name,
        assignments: [],
      });
    }
  };

  const closeAssignModal = () => {
    setAssignModal(null);
    setAssignError('');
    setAssignSubmitting(false);
    fetchDashboards();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal || assignUserId === '') return;
    setAssignError('');
    setAssignSubmitting(true);
    try {
      const res = await apiPost<unknown>(
        `/api/dashboards/${assignModal.dashboardId}/assign`,
        { user_id: Number(assignUserId), permission_type: assignPermission }
      );
      if (res.success) {
        const res2 = await apiGet<Assignment[]>(
          `/api/dashboards/${assignModal.dashboardId}/assignments`
        );
        const list = (res2 as { success?: boolean; data?: Assignment[] }).data;
        setAssignModal((m) =>
          m
            ? {
                ...m,
                assignments: Array.isArray(list) ? list : m.assignments,
              }
            : null
        );
        setAssignUserId('');
        fetchDashboards();
      } else {
        setAssignError((res as { message?: string }).message || 'Assign failed');
      }
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const viewerUsers = users.filter((u) => u.role_name === 'viewer');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          Access Control & Permissions
        </h2>
        <p className="text-gray-600">
          Assign dashboards to users. Admins and developers see all dashboards; viewers only see
          assigned ones.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Dashboard Access */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="font-semibold text-gray-900">Dashboard Assignments</h3>
          </div>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dashboard
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboards.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{d.name}</span>
                      {d.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                          {d.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {d.assignment_count != null ? d.assignment_count : '—'} user(s)
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openAssignModal(d)}
                        className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && dashboards.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No dashboards yet. Create them from the Developer portal.
          </div>
        )}
      </div>

      {/* Feature Permissions (informational) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="font-semibold text-gray-900">Feature Permissions by Role</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Managed by system RBAC. Admins and developers have full dashboard access.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Feature
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Developer
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viewer
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {FEATURES.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{f.name}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                        f.admin ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {f.admin ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                        f.developer ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {f.developer ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                        f.viewer ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {f.viewer ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Assign: {assignModal.dashboardName}
              </h3>
              <button
                onClick={closeAssignModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {assignError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {assignError}
                </div>
              )}
              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                  <select
                    value={assignUserId}
                    onChange={(e) =>
                      setAssignUserId(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">Select user...</option>
                    {viewerUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                    {viewerUsers.length === 0 && (
                      <option value="" disabled>
                        No viewers found
                      </option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permission
                  </label>
                  <select
                    value={assignPermission}
                    onChange={(e) =>
                      setAssignPermission(e.target.value as 'view' | 'edit')
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={assignUserId === '' || assignSubmitting}
                  className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assignSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Assign
                </button>
              </form>
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Current assignments</h4>
                {assignModal.assignments.length === 0 ? (
                  <p className="text-sm text-gray-500">None</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {assignModal.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between">
                        <span>
                          {a.first_name} {a.last_name} ({a.user_email})
                        </span>
                        <span className="text-gray-500">{a.permission_type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
