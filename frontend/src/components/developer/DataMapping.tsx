import { useState, useEffect, useCallback } from 'react';
import { Database, Filter, Search, Plus, Eye, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  source_type: 'excel' | 'api';
  source_config: string | object;
  schema_definition: string | object;
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

export default function DataMapping() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasetData, setDatasetData] = useState<unknown[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<Record<number, boolean>>({});
  // Removed global error state - errors shown only per data source
  const [searchTerm, setSearchTerm] = useState('');

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
    // Don't set global error - errors shown per data source only
    try {
      const res = await apiGet<Dataset[]>('/api/data/datasets');
      if (res.success && res.data) {
        const fetchedDatasets = Array.isArray(res.data) ? res.data : [];
        // Clear status - will be checked individually
        setDatasets(
          fetchedDatasets.map((d) => ({
            ...d,
            connection_status: undefined,
            last_error: undefined,
          }))
        );
        if (fetchedDatasets.length > 0 && !selectedDataset) {
          setSelectedDataset(fetchedDatasets[0]);
        }
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
      // Silently handle errors - don't show global error banner
      console.error('Failed to fetch data sources:', e);
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDataset, checkApiStatus]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const fetchDatasetData = useCallback(
    async (datasetId: number) => {
      setLoadingData(true);
      // Don't set global error - errors shown per data source only
      try {
        const res = await apiGet<DatasetData>(`/api/data/datasets/${datasetId}`);
        if (res.success && res.data) {
          const data = res.data as unknown as DatasetData;
          const rows = Array.isArray(data.data) ? data.data : [];
          setDatasetData(rows);

          // Extract columns from schema or first row
          if (selectedDataset?.schema_definition) {
            try {
              const schema =
                typeof selectedDataset.schema_definition === 'string'
                  ? JSON.parse(selectedDataset.schema_definition)
                  : selectedDataset.schema_definition;
              if (Array.isArray(schema)) {
                setColumns(schema);
              } else if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
                const cols = Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
                  name: key,
                  type: 'string',
                }));
                setColumns(cols);
              }
            } catch {
              // Fallback to first row
              if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
                const cols = Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
                  name: key,
                  type: 'string',
                }));
                setColumns(cols);
              }
            }
          } else if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
            const cols = Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
              name: key,
              type: 'string',
            }));
            setColumns(cols);
          } else {
            setColumns([]);
          }
        } else {
          setDatasetData([]);
          setColumns([]);
        }
      } catch (e) {
        // Don't show global error - log to console
        console.error('Failed to fetch dataset data:', e);
        setDatasetData([]);
        setColumns([]);
      } finally {
        setLoadingData(false);
      }
    },
    [selectedDataset]
  );

  useEffect(() => {
    if (selectedDataset) {
      fetchDatasetData(selectedDataset.id);
    }
  }, [selectedDataset, fetchDatasetData]);

  const toggleColumn = (columnName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnName)
        ? prev.filter((c) => c !== columnName)
        : [...prev, columnName]
    );
  };

  const filteredDatasets = datasets.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (source_type: string) => {
    return source_type === 'api' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700';
  };

  const getStatusBadge = (dataset: Dataset) => {
    const status = dataset.connection_status;
    const isChecking = checkingStatus[dataset.id];

    if (isChecking) {
      return (
        <div className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
          <span className="text-xs text-blue-600">Checking...</span>
        </div>
      );
    }

    if (!status) {
      return null; // Don't show status until checked
    }

    if (status === 'error') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span className="text-xs text-red-600">Error</span>
        </div>
      );
    }

    if (status === 'disconnected') {
      return (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-yellow-600" />
          <span className="text-xs text-yellow-600">Disconnected</span>
        </div>
      );
    }

    if (status === 'connected') {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="text-xs text-green-600">Connected</span>
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
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">Data Mapping</h2>
        <p className="text-gray-600">Map columns and configure data transformations</p>
      </div>

      {/* Global errors removed - errors shown only below data source names */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Source Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Select Data Source</h3>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search data sources..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredDatasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => setSelectedDataset(dataset)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedDataset?.id === dataset.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900 text-sm">{dataset.name}</span>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                          dataset.source_type
                        )}`}
                      >
                        {dataset.source_type === 'api' ? 'API' : 'Excel'}
                      </span>
                    </div>
                    {/* Status shown below the name */}
                    <div className="mt-1">
                      {getStatusBadge(dataset)}
                      {dataset.last_error && (
                        <div className="mt-1 p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          {dataset.last_error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{dataset.row_count.toLocaleString()} records</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading && filteredDatasets.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              {searchTerm ? 'No data sources found' : 'No data sources available'}
            </div>
          )}
        </div>

        {/* Column Selection */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {selectedDataset ? `Columns: ${selectedDataset.name}` : 'Available Columns'}
              </h3>
              {columns.length > 0 && (
                <span className="text-sm text-gray-500">
                  {selectedColumns.length} of {columns.length} selected
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search columns..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="p-6">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : columns.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {columns.map((column) => (
                  <div
                    key={column.name}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedColumns.includes(column.name)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleColumn(column.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{column.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {column.type}
                          </span>
                        </div>
                        {datasetData.length > 0 && (
                          <div className="text-sm text-gray-600">
                            Sample:{' '}
                            <span className="font-mono text-xs">
                              {getSampleValue(datasetData[0], column.name)}
                            </span>
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column.name)}
                        onChange={() => toggleColumn(column.name)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedDataset ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No columns available. Dataset may be empty.</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Eye className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a data source to view columns</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters and Slicers */}
      {selectedDataset && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-indigo-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Filters & Slicers</h3>
            </div>
            <button className="flex items-center px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Plus className="w-4 h-4 mr-2" />
              Add Filter
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Filter configuration will be available after column mapping is complete.
          </div>
        </div>
      )}

      {/* Data Preview */}
      {selectedDataset && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Data Preview</h3>
            <p className="text-sm text-gray-600">
              Preview of data from {selectedDataset.name} ({datasetData.length} rows shown)
            </p>
          </div>
          {loadingData ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : datasetData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {columns.length > 0 ? (
                      columns.map((col) => (
                        <th
                          key={col.name}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {col.name}
                        </th>
                      ))
                    ) : (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        No columns available
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {datasetData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {columns.length > 0 ? (
                        columns.map((col) => (
                          <td key={col.name} className="px-6 py-4 text-sm text-gray-900">
                            {getSampleValue(row, col.name)}
                          </td>
                        ))
                      ) : (
                        <td className="px-6 py-4 text-sm text-gray-500">No data</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No data available in this dataset</p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {selectedDataset && (
        <div className="flex justify-end gap-3">
          <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Apply Mapping
          </button>
        </div>
      )}
    </div>
  );
}
