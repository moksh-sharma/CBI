import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { apiGet } from '../../lib/api';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  details: string | { success?: boolean };
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface AuditApiResponse {
  success: boolean;
  data?: AuditLog[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchLogs = useCallback(async (page = 1, limit = 50) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = (await apiGet<AuditLog[]>(
        `/api/admin/audit-logs?${params}`
      )) as unknown as AuditApiResponse;
      if (res.success && res.data) {
        setLogs(Array.isArray(res.data) ? res.data : []);
        if (res.pagination) {
          setPagination((p) => ({
            ...p,
            ...res.pagination!,
          }));
        }
      } else {
        setLogs([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1, 50);
  }, [fetchLogs]);

  const getStatus = (log: AuditLog): 'success' | 'failed' => {
    if (!log.details) return 'success';
    let d: { success?: boolean } = {};
    try {
      d = typeof log.details === 'string' ? JSON.parse(log.details || '{}') : (log.details as object);
    } catch {
      return 'success';
    }
    return d?.success === false ? 'failed' : 'success';
  };

  const userDisplay = (log: AuditLog) => {
    if (log.user_email) return log.user_email;
    if (log.first_name || log.last_name) {
      return [log.first_name, log.last_name].filter(Boolean).join(' ');
    }
    return 'system';
  };

  const resourceDisplay = (log: AuditLog) => {
    if (log.resource_type && log.resource_id) return `${log.resource_type} #${log.resource_id}`;
    return log.resource_type || '—';
  };

  const filteredLogs = logs.filter((log) => {
    const user = userDisplay(log).toLowerCase();
    const action = log.action.toLowerCase();
    const resource = resourceDisplay(log).toLowerCase();
    const matchesSearch =
      user.includes(searchTerm.toLowerCase()) ||
      action.includes(searchTerm.toLowerCase()) ||
      resource.includes(searchTerm.toLowerCase());
    const status = getStatus(log);
    const matchesStatus =
      filterStatus === 'all' || status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    return status === 'success' ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    );
  };

  const getStatusColor = (status: string) => {
    return status === 'success'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700';
  };

  const successCount = logs.filter((l) => getStatus(l) === 'success').length;
  const failedCount = logs.filter((l) => getStatus(l) === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Audit Logs</h2>
          <p className="text-gray-600">Track all system activities and changes</p>
        </div>
        <button
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          title="Export (coming soon)"
        >
          <Download className="w-5 h-5 mr-2" />
          Export Logs
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by user, action, or resource..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | 'success' | 'failed')
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Successful</p>
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => {
                  const status = getStatus(log);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">
                              {userDisplay(log) === 'system'
                                ? 'SYS'
                                : userDisplay(log).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="ml-3 text-sm text-gray-900">
                            {userDisplay(log)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {resourceDisplay(log)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              status
                            )}`}
                          >
                            {status === 'success' ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredLogs.length === 0 && (
          <div className="p-12 text-center text-gray-500">No audit logs found</div>
        )}
      </div>
    </div>
  );
}
