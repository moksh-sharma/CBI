import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Edit, Trash2, Copy, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiGet } from '../../lib/api';

interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  config: string | object;
  created_by: number;
  created_by_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignment_count?: number;
}

export default function DeveloperHome() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDashboards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Dashboard[]>('/api/dashboards');
      if (res.success && res.data) {
        setDashboards(Array.isArray(res.data) ? res.data : []);
      } else {
        setDashboards([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch dashboards');
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const widgetCount = (d: Dashboard) => {
    if (!d.config) return 0;
    try {
      const c = typeof d.config === 'string' ? JSON.parse(d.config) : d.config;
      const w = (c as { widgets?: unknown[] }).widgets;
      return Array.isArray(w) ? w.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">My Dashboards</h2>
          <p className="text-gray-600">Create and manage your dashboards</p>
        </div>
        <button
          onClick={() => navigate('/developer/builder')}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Dashboard
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Dashboards</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '—' : dashboards.length}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-1">Active</p>
            <p className="text-3xl font-bold text-green-600">
              {loading ? '—' : dashboards.filter((d) => d.is_active).length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Widgets</p>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? '—' : dashboards.reduce((s, d) => s + widgetCount(d), 0)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-1">Assignments</p>
            <p className="text-3xl font-bold text-purple-600">
              {loading
                ? '—'
                : dashboards.reduce((s, d) => s + (d.assignment_count ?? 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dashboards.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{d.name}</h3>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {d.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>By {d.created_by_email ?? '—'}</span>
                      <span>•</span>
                      <span>
                        {d.created_at
                          ? new Date(d.created_at).toLocaleDateString()
                          : '—'}
                      </span>
                      <span>•</span>
                      <span>{widgetCount(d)} widgets</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    {(d.assignment_count ?? 0)} assignment(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/developer/preview/${d.id}`)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/developer/builder/${d.id}`)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Duplicate (coming soon)"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete (coming soon)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && dashboards.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboards yet</h3>
          <p className="text-gray-600 mb-4">Create your first dashboard to get started.</p>
          <button
            onClick={() => navigate('/developer/builder')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            New Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
