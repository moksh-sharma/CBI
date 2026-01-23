import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  CheckCircle,
  Loader2,
  AlertCircle,
  Edit,
  X,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../lib/api';

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  source_type: 'excel' | 'api';
  row_count: number;
  created_at: string;
  updated_at: string;
  connection_status?: 'connected' | 'error' | 'disconnected';
  last_error?: string;
}

interface DatasetData {
  data: unknown[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  is_live?: boolean;
}

export default function APIConfiguration() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'sources' | 'preview'>('sources');
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Data Preview state
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [previewColumns, setPreviewColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Check real API status for a dataset
  const checkApiStatus = useCallback(async (dataset: Dataset) => {
    if (dataset.source_type !== 'api') return;

    setCheckingStatus((prev) => ({ ...prev, [dataset.id]: true }));

    try {
      const res = await apiPost<{
        status: 'connected' | 'error' | 'disconnected';
        row_count?: number;
        error?: string;
      }>(`/api/data/datasets/${dataset.id}/refresh`);

      const statusData = res.data;
      if (statusData) {
        setDatasets((prev) =>
          prev.map((d) =>
            d.id === dataset.id
              ? {
                  ...d,
                  connection_status: statusData.status || (res.success ? 'connected' : 'error'),
                  row_count: statusData.row_count ?? d.row_count,
                  last_error: statusData.error || (res.success ? undefined : res.message),
                }
              : d
          )
        );
      } else {
        setDatasets((prev) =>
          prev.map((d) =>
            d.id === dataset.id
              ? {
                  ...d,
                  connection_status: res.success ? 'connected' : 'error',
                  last_error: res.success ? undefined : res.message || 'Status check failed',
                }
              : d
          )
        );
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to check API status';
      setDatasets((prev) =>
        prev.map((d) =>
          d.id === dataset.id
            ? {
                ...d,
                connection_status: 'error',
                last_error: errorMsg,
              }
            : d
        )
      );
    } finally {
      setCheckingStatus((prev) => {
        const newState = { ...prev };
        delete newState[dataset.id];
        return newState;
      });
    }
  }, []);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<Dataset[]>('/api/data/datasets');
      if (res.success && res.data) {
        // Show ALL data sources (not just API)
        const fetchedDatasets = Array.isArray(res.data) ? res.data : [];
        setDatasets(
          fetchedDatasets.map((d) => ({
            ...d,
            connection_status: undefined,
            last_error: undefined,
          }))
        );
        // Check status for all API datasets
        fetchedDatasets.forEach((d) => {
          if (d.source_type === 'api') {
            checkApiStatus(d);
          }
        });
      } else {
        setDatasets([]);
      }
    } catch (e) {
      console.error('Failed to fetch data sources:', e);
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, [checkApiStatus]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleEdit = (dataset: Dataset) => {
    setEditingDataset(dataset);
    setEditName(dataset.name);
    setEditDescription(dataset.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingDataset || !editName.trim()) return;

    setSaving(true);
    try {
      const res = await apiPut<Dataset>(`/api/data/datasets/${editingDataset.id}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      if (res.success && res.data) {
        setDatasets((prev) =>
          prev.map((d) => (d.id === editingDataset.id ? res.data! : d))
        );
        setEditingDataset(null);
      }
    } catch (e) {
      console.error('Failed to update dataset:', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (dataset: Dataset) => {
    setPreviewDataset(dataset);
    setActiveTab('preview');
    setLoadingPreview(true);
    setPreviewData([]);
    setPreviewColumns([]);

    try {
      const res = await apiGet<DatasetData>(`/api/data/datasets/${dataset.id}`);
      if (res.success && res.data) {
        const data = res.data as unknown as DatasetData;
        const rows = Array.isArray(data.data) ? data.data : [];
        setPreviewData(rows);

        // Extract columns from first row
        if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          const cols = Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
            name: key,
            type: 'string',
          }));
          setPreviewColumns(cols);
        }
      }
    } catch (e) {
      console.error('Failed to fetch preview data:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const getStatusBadge = (dataset: Dataset) => {
    const status = dataset.connection_status;
    const isChecking = checkingStatus[dataset.id];

    if (isChecking) {
      return (
        <div className="flex items-center gap-1">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="text-sm text-blue-600 font-medium">Checking...</span>
        </div>
      );
    }

    if (!status) {
      // For Excel sources, show as connected (no API to check)
      if (dataset.source_type === 'excel') {
        return (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600 font-medium">Available</span>
          </div>
        );
      }
      return null; // Don't show status until checked for API
    }

    if (status === 'error') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-600 font-medium">Error</span>
        </div>
      );
    }

    if (status === 'disconnected') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="text-sm text-yellow-600 font-medium">Disconnected</span>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-600 font-medium">Connected</span>
        </div>
      );
    }

    return null;
  };

  const getSampleValue = (row: unknown, colName: string) => {
    if (typeof row === 'object' && row !== null) {
      const obj = row as Record<string, unknown>;
      const val = obj[colName];
      if (val === null || val === undefined) return '—';
      if (typeof val === 'object') return JSON.stringify(val).slice(0, 50);
      return String(val);
    }
    return '—';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Data Sources</h2>
        <p className="text-gray-600">View and manage all data sources with real-time status</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sources')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sources'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Sources
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Preview
          </button>
        </nav>
      </div>

      {/* Data Sources Tab */}
      {activeTab === 'sources' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">All Data Sources</h3>
            <button
              onClick={fetchDatasets}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
              title="Refresh list"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start flex-1">
                      <div className="bg-purple-100 p-3 rounded-lg">
                        <Database className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="mb-2">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{dataset.name}</h4>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                dataset.source_type === 'api'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {dataset.source_type === 'api' ? 'API' : 'Excel'}
                            </span>
                          </div>
                          {/* Status shown below the name */}
                          <div className="mt-1">
                            {getStatusBadge(dataset)}
                            {dataset.last_error && (
                              <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                {dataset.last_error}
                              </div>
                            )}
                          </div>
                        </div>
                        {dataset.description && (
                          <p className="text-sm text-gray-600 mb-3">{dataset.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Records:</span>
                            <span className="ml-2 text-gray-900 font-medium">
                              {typeof dataset.row_count === 'number'
                                ? dataset.row_count.toLocaleString()
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="ml-2 text-gray-900 font-medium">
                              {dataset.updated_at
                                ? new Date(dataset.updated_at).toLocaleString()
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(dataset)}
                        className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handlePreview(dataset)}
                        className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && datasets.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Sources</h3>
              <p className="text-gray-600">
                Data sources must be created by an administrator. Contact your admin to set up data
                connections.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Data Preview Tab */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Data Preview</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {previewDataset
                    ? `Previewing: ${previewDataset.name}`
                    : 'Select a data source and click Preview to view data'}
                </p>
              </div>
              {previewDataset && (
                <button
                  onClick={() => handlePreview(previewDataset)}
                  disabled={loadingPreview}
                  className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingPreview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh Data
                </button>
              )}
            </div>
          </div>
          {!previewDataset ? (
            <div className="p-12 text-center text-gray-500">
              <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Selected</h3>
              <p className="text-gray-600">
                Go to the Data Sources tab and click "Preview" on any data source to view its data
                here.
              </p>
            </div>
          ) : loadingPreview ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : previewData.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className="ml-2 font-medium">
                      {getStatusBadge(previewDataset)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rows:</span>
                    <span className="ml-2 font-medium">{previewData.length.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Columns:</span>
                    <span className="ml-2 font-medium">{previewColumns.length}</span>
                  </div>
                  {previewDataset.source_type === 'api' && (
                    <div className="flex items-center gap-1 text-indigo-600">
                      <Database className="w-4 h-4" />
                      <span className="text-xs font-medium">Live API Data</span>
                    </div>
                  )}
                </div>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {previewColumns.map((col) => (
                      <th
                        key={col.name}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {previewColumns.map((col) => (
                        <td key={col.name} className="px-6 py-4 text-sm text-gray-900">
                          {getSampleValue(row, col.name)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <div className="px-6 py-4 bg-gray-50 text-sm text-gray-600 text-center">
                  Showing first 50 rows of {previewData.length.toLocaleString()} total rows
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No data available in this dataset</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Data Source</h2>
              <button
                onClick={() => setEditingDataset(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setEditingDataset(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
