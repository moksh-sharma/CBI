import { useState, useEffect, useCallback } from 'react';
import { X, UserPlus, Search, CheckCircle, Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_id: number;
  role_name: string;
}

interface UserAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedUserIds: number[], dashboardName?: string) => void;
  dashboardId: number | null;
  publishing: boolean;
  dashboardName?: string;
}

export default function UserAssignmentModal({
  isOpen,
  onClose,
  onConfirm,
  dashboardId,
  publishing,
  dashboardName: initialDashboardName = '',
}: UserAssignmentModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [existingAssignments, setExistingAssignments] = useState<number[]>([]);
  const [dashboardName, setDashboardName] = useState(initialDashboardName);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<User[]>('/api/users');
      if (res.success && res.data) {
        const userList = Array.isArray(res.data) ? res.data : [];
        setUsers(userList);
        if (userList.length === 0) {
          setError('No users found in the database');
        }
      } else {
        setUsers([]);
        setError(res.message || 'Failed to fetch users');
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
      setUsers([]);
      setError(e instanceof Error ? e.message : 'Failed to fetch users. Please check your permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExistingAssignments = useCallback(async () => {
    if (!dashboardId) return;
    try {
      const res = await apiGet<Array<{ user_id: number }>>(`/api/dashboards/${dashboardId}/assignments`);
      if (res.success && res.data) {
        const userIds = Array.isArray(res.data) ? res.data.map((a) => a.user_id) : [];
        setExistingAssignments(userIds);
        setSelectedUserIds(new Set(userIds));
      }
    } catch (e) {
      console.error('Failed to fetch assignments:', e);
    }
  }, [dashboardId]);

  useEffect(() => {
    if (isOpen) {
      setDashboardName(initialDashboardName);
      fetchUsers();
      if (dashboardId) {
        fetchExistingAssignments();
      }
    }
  }, [isOpen, fetchUsers, dashboardId, fetchExistingAssignments, initialDashboardName]);

  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.first_name.toLowerCase().includes(searchLower) ||
      user.last_name.toLowerCase().includes(searchLower)
    );
  });

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleConfirm = () => {
    if (!dashboardName.trim()) {
      setError('Dashboard name is required');
      return;
    }
    onConfirm(Array.from(selectedUserIds), dashboardName.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[99999]" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative" style={{ zIndex: 100000 }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Publish Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">Select users to assign this dashboard to</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={publishing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Dashboard Name Input */}
          <div className="mb-4">
            <label htmlFor="dashboard-name" className="block text-sm font-medium text-gray-700 mb-2">
              Dashboard Name <span className="text-red-500">*</span>
            </label>
            <input
              id="dashboard-name"
              type="text"
              value={dashboardName}
              onChange={(e) => {
                setDashboardName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter dashboard name..."
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                error && !dashboardName.trim() ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={publishing}
            />
            {error && !dashboardName.trim() && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Select All */}
          {filteredUsers.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedUserIds.size} selected)
                </span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && dashboardName.trim() && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Users List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : error && !dashboardName.trim() ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-red-600 mb-2">{error}</p>
              <p className="text-sm text-gray-500">Please ensure you have permission to view users.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No users found</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search term</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isSelected = selectedUserIds.has(user.id);
                const isExisting = existingAssignments.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          {isSelected ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <span className="text-gray-600 font-medium">
                              {user.first_name[0]}{user.last_name[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-500 capitalize">{user.role_name}</p>
                        </div>
                      </div>
                      {isExisting && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          Already Assigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={publishing || selectedUserIds.size === 0 || !dashboardName.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Publish & Assign ({selectedUserIds.size})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
