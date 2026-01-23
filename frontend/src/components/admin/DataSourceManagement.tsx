import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Upload,
  RefreshCw,
  CheckCircle,
  Link2,
  Loader2,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { apiGet, apiPostForm, apiDelete, apiPost, apiPut } from '../../lib/api';
import APIConfigModal from './APIConfigModal';
import ZohoAPIModal from './ZohoAPIModal';
import FileUploadModal from './FileUploadModal';
import EditDatasetModal from './EditDatasetModal';

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  source_type: 'excel' | 'api';
  source_config: string | object;
  schema_definition: string | object;
  row_count: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  created_by_email?: string;
  connection_status?: 'connected' | 'error' | 'disconnected';
  last_error?: string;
}

interface ApiConfig {
  id: number;
  name: string;
  base_url: string;
  endpoint: string | null;
  method: string;
  auth_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_email?: string;
}

interface DataSourceItem {
  id: number;
  name: string;
  description: string | null;
  source_type: 'excel' | 'api' | 'api_config';
  row_count?: number;
  created_at: string;
  updated_at: string;
  created_by_email?: string;
  connection_status?: 'connected' | 'error' | 'disconnected';
  last_error?: string;
  is_active?: boolean; // For API configs
}

export default function DataSourceManagement() {
  const [dataSources, setDataSources] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed global error state - errors shown only per data source
  const [refreshing, setRefreshing] = useState<Record<number, boolean>>({});
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [showZohoModal, setShowZohoModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [selectedSources, setSelectedSources] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchDataSources = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both datasets and API configs
      const [datasetsRes, apiConfigsRes] = await Promise.all([
        apiGet<Dataset[]>('/api/data/datasets'),
        apiGet<ApiConfig[]>('/api/admin/api-configs'),
      ]);

      const allSources: DataSourceItem[] = [];
      const datasets = datasetsRes.success && datasetsRes.data ? (Array.isArray(datasetsRes.data) ? datasetsRes.data : []) : [];

      // Add datasets - preserve connection_status and last_error from database
      datasets.forEach((d) => {
        allSources.push({
          id: d.id,
          name: d.name,
          description: d.description,
          source_type: d.source_type,
          row_count: d.row_count,
          created_at: d.created_at,
          updated_at: d.updated_at,
          created_by_email: d.created_by_email,
          connection_status: d.connection_status, // Preserve from database
          last_error: d.last_error, // Preserve from database
        });
      });

      // Add API configs (that don't have datasets yet - draft configs)
      if (apiConfigsRes.success && apiConfigsRes.data) {
        const apiConfigs = Array.isArray(apiConfigsRes.data) ? apiConfigsRes.data : [];
        apiConfigs.forEach((config) => {
          // Check if this config already has a dataset
          const hasDataset = datasets.some((d) => {
            if (d.source_type !== 'api') return false;
            try {
              const sourceConfig =
                typeof d.source_config === 'string'
                  ? JSON.parse(d.source_config)
                  : d.source_config;
              return (
                sourceConfig &&
                typeof sourceConfig === 'object' &&
                (sourceConfig as { api_config_id?: number }).api_config_id === config.id
              );
            } catch {
              return false;
            }
          });

          // Only add if it doesn't have a dataset (draft configs)
          if (!hasDataset && config.is_active) {
            allSources.push({
              id: config.id,
              name: config.name,
              description: `API Configuration - ${config.base_url}${config.endpoint || ''}`,
              source_type: 'api_config',
              created_at: config.created_at,
              updated_at: config.updated_at,
              created_by_email: config.created_by_email,
              is_active: config.is_active,
              connection_status: undefined,
            });
          }
        });
      }

      // Sort by updated_at descending
      allSources.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      setDataSources(allSources);
    } catch (e) {
      console.error('Failed to fetch data sources:', e);
      setDataSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  const handleUpload = async (file: File, name: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    const res = await apiPostForm<Dataset>('/api/data/upload', fd);
    if (!res.success) throw new Error(res.message || 'Upload failed');
    await fetchDataSources();
  };

  const handleSaveAPIConfig = () => {
    setShowAPIModal(false);
    fetchDataSources(); // Refresh to show new config immediately
  };

  const handleSaveZohoConfig = () => {
    setShowZohoModal(false);
    fetchDataSources(); // Refresh to show new config immediately
  };

  const handleEditConfig = async (configId: number) => {
    try {
      const res = await apiGet<ApiConfig>(`/api/admin/api-configs/${configId}`);
      if (res.success && res.data) {
        setEditingConfig(res.data);
        setShowAPIModal(true);
      }
    } catch (e) {
      console.error('Failed to load config for editing:', e);
    }
  };

  const handleEditDataset = async (source: DataSourceItem) => {
    try {
      if (source.source_type === 'api_config') {
        // Edit API config
        await handleEditConfig(source.id);
      } else {
        // Edit dataset (name, description)
        const res = await apiGet<Dataset>(`/api/data/datasets/${source.id}`);
        if (res.success && res.data) {
          setEditingDataset(res.data);
          setShowEditModal(true);
        }
      }
    } catch (e) {
      console.error('Failed to load dataset for editing:', e);
    }
  };

  const handleCloseAPIModal = () => {
    setShowAPIModal(false);
    setEditingConfig(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingDataset(null);
  };

  const handleSaveDataset = async (name: string, description: string) => {
    if (!editingDataset) return;
    
    try {
      const res = await apiPut<Dataset>(`/api/data/datasets/${editingDataset.id}`, {
        name,
        description,
      });
      if (res.success) {
        await fetchDataSources();
        handleCloseEditModal();
      }
    } catch (e) {
      console.error('Failed to save dataset:', e);
      alert('Failed to save dataset. Please try again.');
    }
  };

  // Clear selections when data sources change
  useEffect(() => {
    setSelectedSources(new Set());
  }, [dataSources.length]);

  const getTypeLabel = (source_type: string) => {
    if (source_type === 'api') return 'API';
    if (source_type === 'api_config') return 'API Config';
    return 'Excel';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      API: 'bg-indigo-100 text-indigo-700',
      'API Config': 'bg-yellow-100 text-yellow-700',
      Excel: 'bg-green-100 text-green-700',
      'Zoho API': 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const handleRefresh = async (source: DataSourceItem) => {
    setRefreshing((prev) => ({ ...prev, [source.id]: true }));

    try {
      if (source.source_type === 'api') {
        // Refresh API dataset - fetch live data
        const res = await apiPost<{
          status: 'connected' | 'error' | 'disconnected';
          row_count?: number;
          last_refreshed?: string;
          error?: string;
        }>(`/api/data/datasets/${source.id}/refresh`);

        const statusData = res.data;
        if (statusData) {
          // Update local state AND refresh from database to ensure persistence
          setDataSources((prev) =>
            prev.map((d) =>
              d.id === source.id
                ? {
                    ...d,
                    connection_status: statusData.status || (res.success ? 'connected' : 'error'),
                    row_count: statusData.row_count ?? d.row_count,
                    updated_at: statusData.last_refreshed || d.updated_at,
                    last_error: statusData.error || (res.success ? undefined : res.message),
                  }
                : d
            )
          );
          // Refresh from database to ensure all changes are persisted
          await fetchDataSources();
        } else {
          setDataSources((prev) =>
            prev.map((d) =>
              d.id === source.id
                ? {
                    ...d,
                    connection_status: res.success ? 'connected' : 'error',
                    last_error: res.success ? undefined : res.message || 'Refresh failed',
                  }
                : d
            )
          );
          // Refresh from database to ensure all changes are persisted
          await fetchDataSources();
        }
      } else if (source.source_type === 'api_config') {
        // For API configs, we can't refresh data (no dataset yet), but we can test the connection
        // Just refresh the list to get updated status
        await fetchDataSources();
      } else if (source.source_type === 'excel') {
        // For Excel files, refresh metadata
        await fetchDataSources();
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to refresh data source';
      setDataSources((prev) =>
        prev.map((d) =>
          d.id === source.id
            ? {
                ...d,
                connection_status: 'error',
                last_error: errorMsg,
              }
            : d
        )
      );
    } finally {
      setRefreshing((prev) => {
        const newState = { ...prev };
        delete newState[source.id];
        return newState;
      });
    }
  };

  const handleDelete = async (source: DataSourceItem) => {
    if (!window.confirm('Delete this data source? This cannot be undone.')) return;
    try {
      if (source.source_type === 'api_config') {
        // Delete API config
        const res = await apiDelete<unknown>(`/api/admin/api-configs/${source.id}`);
        if (res.success) {
          await fetchDataSources();
        }
      } else {
        // Delete dataset
        const res = await apiDelete<unknown>(`/api/data/datasets/${source.id}`);
        if (res.success) {
          await fetchDataSources();
        }
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleToggleSelect = (sourceId: number) => {
    setSelectedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedSources.size === dataSources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(dataSources.map((d) => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSources.size === 0) return;
    
    const count = selectedSources.size;
    if (!window.confirm(`Delete ${count} selected data source(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedSources).map(async (id) => {
        const source = dataSources.find((d) => d.id === id);
        if (!source) return;

        if (source.source_type === 'api_config') {
          return apiDelete<unknown>(`/api/admin/api-configs/${id}`);
        } else {
          return apiDelete<unknown>(`/api/data/datasets/${id}`);
        }
      });

      await Promise.all(deletePromises);
      setSelectedSources(new Set());
      await fetchDataSources();
    } catch (e) {
      console.error('Bulk delete failed:', e);
      alert('Some items failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (source: DataSourceItem) => {
    // Only show status if it has been explicitly tested (not default/demo value)
    const status = source.connection_status;
    const isRefreshing = refreshing[source.id];

    if (isRefreshing) {
      return (
        <div className="flex items-center gap-1">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            Refreshing...
          </span>
        </div>
      );
    }

    // Only show status if it has been tested - no default/demo values
    if (!status) {
      return null; // Don't show any status badge until tested
    }

    if (status === 'error') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            Error
          </span>
        </div>
      );
    }

    if (status === 'disconnected') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
            Disconnected
          </span>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            Connected
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Data Source Management</h2>
          <p className="text-gray-600">Connect and manage your data sources</p>
        </div>
      </div>

      {/* Global errors removed - errors shown only below data source names */}

      {/* Connection Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setShowZohoModal(true)}
          className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-200 hover:border-purple-500 transition-all text-left group"
        >
          <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
            <Database className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Connect Zoho API</h3>
          <p className="text-sm text-gray-600">Integrate with Zoho CRM, Books, and more</p>
        </button>

        <button
          onClick={() => setShowAPIModal(true)}
          className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-200 hover:border-indigo-500 transition-all text-left group"
        >
          <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
            <Link2 className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Configure API Connection</h3>
          <p className="text-sm text-gray-600">Connect to any REST API with custom configuration</p>
        </button>

        <button
          onClick={() => setShowFileModal(true)}
          className="bg-white rounded-xl p-6 shadow-sm border-2 border-gray-200 hover:border-green-500 transition-all text-left group"
        >
          <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
            <Upload className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Upload Data File</h3>
          <p className="text-sm text-gray-600">Import from Excel or CSV</p>
        </button>
      </div>

      {/* Data Sources List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Connected Data Sources</h3>
            <div className="flex items-center gap-3">
              {selectedSources.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Selected ({selectedSources.size})
                </button>
              )}
              <button
                onClick={fetchDataSources}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                title="Refresh list of data sources"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {dataSources.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedSources.size === dataSources.length && dataSources.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label className="text-sm text-gray-600 cursor-pointer" onClick={handleSelectAll}>
                Select All
              </label>
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {dataSources.map((d) => (
              <div key={d.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1 gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(d.id)}
                      onChange={() => handleToggleSelect(d.id)}
                      className="mt-2 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <Database className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="mb-2">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h4 className="font-semibold text-gray-900">{d.name}</h4>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(
                              getTypeLabel(d.source_type)
                            )}`}
                          >
                            {getTypeLabel(d.source_type)}
                          </span>
                        </div>
                        {/* Status shown below the name */}
                        <div className="mt-1">
                          {d.source_type !== 'api_config' && getStatusBadge(d)}
                          {d.source_type === 'api_config' && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                              Draft
                            </span>
                          )}
                          {d.last_error && (
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              {d.last_error}
                            </div>
                          )}
                        </div>
                      </div>
                      {d.description && (
                        <p className="text-sm text-gray-600 mb-3">{d.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Added: </span>
                          <span className="text-gray-900 font-medium">
                            {d.created_at
                              ? new Date(d.created_at).toLocaleString()
                              : '—'}
                          </span>
                        </div>
                        {d.source_type !== 'api_config' && (
                          <div>
                            <span className="text-gray-500">Records: </span>
                            <span className="text-gray-900 font-medium">
                              {typeof d.row_count === 'number'
                                ? d.row_count.toLocaleString()
                                : '—'}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Last Updated: </span>
                          <span className="text-gray-900 font-medium">
                            {d.updated_at
                              ? new Date(d.updated_at).toLocaleString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {/* Edit button for all data sources */}
                    <button
                      onClick={() => handleEditDataset(d)}
                      className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
                      title={d.source_type === 'api_config' ? 'Edit API configuration' : 'Edit data source'}
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    {/* Refresh button for all data sources */}
                    <button
                      onClick={() => handleRefresh(d)}
                      disabled={refreshing[d.id]}
                      className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      title={
                        d.source_type === 'api'
                          ? 'Refresh API connection and update data'
                          : d.source_type === 'api_config'
                          ? 'Refresh connection status'
                          : 'Refresh data source'
                      }
                    >
                      {refreshing[d.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Refresh
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && dataSources.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No data sources yet. Upload a file or configure an API.
          </div>
        )}
      </div>

      <APIConfigModal
        isOpen={showAPIModal}
        onClose={handleCloseAPIModal}
        onSave={handleSaveAPIConfig}
        editingConfig={editingConfig}
      />
      <ZohoAPIModal
        isOpen={showZohoModal}
        onClose={() => setShowZohoModal(false)}
        onSave={handleSaveZohoConfig}
      />
      <FileUploadModal
        isOpen={showFileModal}
        onClose={() => setShowFileModal(false)}
        onUpload={handleUpload}
      />
      <EditDatasetModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSave={handleSaveDataset}
        dataset={editingDataset}
      />
    </div>
  );
}
