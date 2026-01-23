import { useState, useRef, createRef, useEffect, useCallback } from 'react';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table as TableIcon, Save, Eye, ArrowLeft, Activity, Target, Gauge, Grid3x3, X, ChevronRight, ChevronDown, Layers, Hash, Filter as FilterIcon, GripVertical, Database, Loader2, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Treemap } from 'recharts';
import { useNavigate, useParams } from 'react-router';
import Draggable from 'react-draggable';
import { Resizable } from 're-resizable';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import UserAssignmentModal from './UserAssignmentModal';
import DashboardDetailsModal from './DashboardDetailsModal';

interface Widget {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'table' | 'stacked-bar' | 'area' | 'donut' | 'treemap' | 'gauge' | 'card' | 'filter';
  title: string;
  dataKey?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  aggregation?: 'count' | 'sum' | 'first' | 'last' | 'percentage';
  field?: string;
  xAxis?: string;
  yAxis?: string;
  legend?: string;
  filterField?: string;
  selectedFilters?: string[];
  datasetId?: number; // Link widget to a data source
}

interface Dataset {
  id: number;
  name: string;
  description: string | null;
  source_type: 'excel' | 'api';
  schema_definition: string | object;
  row_count: number;
  connection_status?: 'connected' | 'error' | 'disconnected';
}

interface Column {
  name: string;
  type: string;
}

export default function DashboardBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [dataSourcesPanelExpanded, setDataSourcesPanelExpanded] = useState(true);
  const [columnsPanelExpanded, setColumnsPanelExpanded] = useState(true);
  const [globalFilters, setGlobalFilters] = useState<{ [key: string]: string[] }>({});
  const [dashboardName, setDashboardName] = useState('Untitled Dashboard');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [dashboardCategory, setDashboardCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'save' | 'publish' | null>(null);
  const [dashboardId, setDashboardId] = useState<number | null>(id ? parseInt(id) : null);
  
  // Data source management
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<number>>(new Set());
  const [columns, setColumns] = useState<Record<number, Column[]>>({}); // datasetId -> columns
  const [datasetData, setDatasetData] = useState<Record<number, unknown[]>>({}); // datasetId -> data rows
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [loadingData, setLoadingData] = useState<Record<number, boolean>>({});
  const [draggedColumn, setDraggedColumn] = useState<{ datasetId: number; columnName: string } | null>(null);

  // Fetch datasets on mount
  useEffect(() => {
    const fetchDatasets = async () => {
      setLoadingDatasets(true);
      try {
        const res = await apiGet<Dataset[]>('/api/data/datasets');
        if (res.success && res.data) {
          const fetchedDatasets = Array.isArray(res.data) ? res.data : [];
          setDatasets(fetchedDatasets);
        }
      } catch (e) {
        console.error('Failed to fetch datasets:', e);
      } finally {
        setLoadingDatasets(false);
      }
    };
    fetchDatasets();
  }, []);

  // Fetch data and columns for selected datasets
  const fetchDatasetData = useCallback(async (datasetId: number) => {
    setLoadingData((prev) => ({ ...prev, [datasetId]: true }));
    try {
      const res = await apiGet<{ data: unknown[]; pagination?: unknown }>(`/api/data/datasets/${datasetId}`);
      if (res.success && res.data) {
        const rows = Array.isArray(res.data.data) ? res.data.data : [];
        setDatasetData((prev) => ({ ...prev, [datasetId]: rows }));

        // Extract columns from schema or first row
        const dataset = datasets.find((d) => d.id === datasetId);
        let cols: Column[] = [];
        
        if (dataset?.schema_definition) {
          try {
            const schema =
              typeof dataset.schema_definition === 'string'
                ? JSON.parse(dataset.schema_definition)
                : dataset.schema_definition;
            if (Array.isArray(schema)) {
              cols = schema;
            }
          } catch {
            // Fallback to first row
          }
        }
        
        if (cols.length === 0 && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          cols = Object.keys(rows[0] as Record<string, unknown>).map((key) => ({
            name: key,
            type: 'string',
          }));
        }
        
        setColumns((prev) => ({ ...prev, [datasetId]: cols }));
      }
    } catch (e) {
      console.error('Failed to fetch dataset data:', e);
    } finally {
      setLoadingData((prev) => ({ ...prev, [datasetId]: false }));
    }
  }, [datasets]);

  // Fetch data when dataset is selected
  useEffect(() => {
    selectedDatasets.forEach((datasetId) => {
      if (!columns[datasetId] && !loadingData[datasetId]) {
        fetchDatasetData(datasetId);
      }
    });
  }, [selectedDatasets, columns, loadingData, fetchDatasetData]);

  // Load existing dashboard if id is provided
  useEffect(() => {
    if (id) {
      const loadDashboard = async () => {
        try {
          const res = await apiGet<{
            id: number;
            name: string;
            description: string | null;
            config: string | { widgets: Widget[]; selectedDatasets?: number[]; category?: string };
          }>(`/api/dashboards/${id}`);
          if (res.success && res.data) {
            setDashboardId(res.data.id);
            setDashboardName(res.data.name || 'Untitled Dashboard');
            setDashboardDescription(res.data.description || '');
            const config = typeof res.data.config === 'string' ? JSON.parse(res.data.config) : res.data.config;
            if (config.widgets) {
              setWidgets(config.widgets);
            }
            if (config.selectedDatasets) {
              setSelectedDatasets(new Set(config.selectedDatasets));
            }
            if (config.category) {
              setDashboardCategory(config.category);
            }
          }
        } catch (e) {
          console.error('Failed to load dashboard:', e);
        }
      };
      loadDashboard();
    }
  }, [id]);

  const visualizationTypes = [
    { type: 'bar' as const, icon: BarChart3, label: 'Bar', color: 'text-blue-600' },
    { type: 'stacked-bar' as const, icon: Layers, label: 'Stacked', color: 'text-blue-600' },
    { type: 'line' as const, icon: LineChartIcon, label: 'Line', color: 'text-green-600' },
    { type: 'area' as const, icon: Activity, label: 'Area', color: 'text-purple-600' },
    { type: 'pie' as const, icon: PieChartIcon, label: 'Pie', color: 'text-orange-600' },
    { type: 'donut' as const, icon: Target, label: 'Donut', color: 'text-pink-600' },
    { type: 'treemap' as const, icon: Grid3x3, label: 'Treemap', color: 'text-teal-600' },
    { type: 'gauge' as const, icon: Gauge, label: 'Gauge', color: 'text-indigo-600' },
    { type: 'card' as const, icon: Hash, label: 'Card', color: 'text-cyan-600' },
    { type: 'filter' as const, icon: FilterIcon, label: 'Filter', color: 'text-red-600' },
    { type: 'table' as const, icon: TableIcon, label: 'Table', color: 'text-gray-600' },
  ];

  const toggleDatasetSelection = (datasetId: number) => {
    setSelectedDatasets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(datasetId)) {
        newSet.delete(datasetId);
        // Remove columns and data for deselected dataset
        setColumns((cols) => {
          const newCols = { ...cols };
          delete newCols[datasetId];
          return newCols;
        });
        setDatasetData((data) => {
          const newData = { ...data };
          delete newData[datasetId];
          return newData;
        });
      } else {
        newSet.add(datasetId);
      }
      return newSet;
    });
  };

  const handleDragStart = (datasetId: number, columnName: string) => {
    setDraggedColumn({ datasetId, columnName });
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const handleDrop = (target: 'xAxis' | 'yAxis' | 'legend', widgetId: string) => {
    if (!draggedColumn || !selectedWidget) return;
    
    const columnName = draggedColumn.columnName;
    const updates: Partial<Widget> = {};
    
    if (target === 'xAxis') {
      updates.xAxis = columnName;
    } else if (target === 'yAxis') {
      updates.yAxis = columnName;
    } else if (target === 'legend') {
      updates.legend = columnName;
    }
    
    // Also link widget to the dataset
    updates.datasetId = draggedColumn.datasetId;
    
    updateWidget(widgetId, updates);
    setDraggedColumn(null);
  };

  const handleSaveClick = () => {
    if (!dashboardId) {
      // New dashboard - show details modal first
      setPendingAction('save');
      setShowDetailsModal(true);
    } else {
      // Existing dashboard - save directly
      handleSave();
    }
  };

  const handleSave = async (details?: { name: string; category: string; description: string }) => {
    const name = details?.name || dashboardName;
    const category = details?.category || dashboardCategory;
    const description = details?.description || dashboardDescription;

    if (!name.trim()) {
      alert('Please enter a dashboard name');
      return;
    }

    setSaving(true);
    try {
      const config = {
        widgets,
        selectedDatasets: Array.from(selectedDatasets),
        category: category || undefined,
      };

      if (dashboardId) {
        // Update existing dashboard
        const res = await apiPut<{ id: number; name: string }>(`/api/dashboards/${dashboardId}`, {
          name: name.trim(),
          description: description.trim() || null,
          config: JSON.stringify(config),
        });

        if (res.success) {
          setDashboardName(name);
          setDashboardCategory(category);
          setDashboardDescription(description);
          alert('Dashboard saved successfully!');
        } else {
          throw new Error(res.message || 'Failed to save dashboard');
        }
      } else {
        // Create new dashboard
        const res = await apiPost<{ id: number; name: string }>('/api/dashboards', {
          name: name.trim(),
          description: description.trim() || null,
          config: JSON.stringify(config),
        });

        if (res.success && res.data) {
          setDashboardId(res.data.id);
          setDashboardName(name);
          setDashboardCategory(category);
          setDashboardDescription(description);
          alert('Dashboard saved successfully!');
        } else {
          throw new Error(res.message || 'Failed to save dashboard');
        }
      }
    } catch (e) {
      console.error('Save error:', e);
      alert(e instanceof Error ? e.message : 'Failed to save dashboard');
    } finally {
      setSaving(false);
      setShowDetailsModal(false);
      setPendingAction(null);
    }
  };

  const handlePublishClick = () => {
    if (!dashboardId) {
      // New dashboard - show details modal first
      setPendingAction('publish');
      setShowDetailsModal(true);
    } else {
      // Existing dashboard - show publish modal directly
      setShowPublishModal(true);
    }
  };

  const handleDetailsSave = async (details: { name: string; category: string; description: string }) => {
    setDashboardName(details.name);
    setDashboardCategory(details.category);
    setDashboardDescription(details.description);

    if (pendingAction === 'save') {
      await handleSave(details);
    } else if (pendingAction === 'publish') {
      setShowDetailsModal(false);
      setPendingAction(null);
      // After saving details, proceed with publish
      await handleSave(details);
      setShowPublishModal(true);
    }
  };

  const handlePublishConfirm = async (selectedUserIds: number[], dashboardName?: string) => {
    // Update dashboard name if provided
    if (dashboardName && dashboardName.trim()) {
      setDashboardName(dashboardName.trim());
    }
    if (!dashboardName.trim()) {
      alert('Please enter a dashboard name');
      return;
    }

    setPublishing(true);
    try {
      const config = {
        widgets,
        selectedDatasets: Array.from(selectedDatasets),
        category: dashboardCategory || undefined,
      };

      let finalDashboardId = dashboardId;

      // Save/Update dashboard first
      if (dashboardId) {
        // Update existing dashboard
        const res = await apiPut<{ id: number; name: string }>(`/api/dashboards/${dashboardId}`, {
          name: dashboardName.trim(),
          description: dashboardDescription.trim() || null,
          config: JSON.stringify(config),
        });

        if (!res.success) {
          throw new Error(res.message || 'Failed to save dashboard');
        }
      } else {
        // Create new dashboard
        const res = await apiPost<{ id: number; name: string }>('/api/dashboards', {
          name: dashboardName.trim(),
          description: dashboardDescription.trim() || null,
          config: JSON.stringify(config),
        });

        if (res.success && res.data) {
          finalDashboardId = res.data.id;
          setDashboardId(res.data.id);
        } else {
          throw new Error(res.message || 'Failed to create dashboard');
        }
      }

      // Assign dashboard to selected users
      if (finalDashboardId && selectedUserIds.length > 0) {
        const assignPromises = selectedUserIds.map((userId) =>
          apiPost(`/api/dashboards/${finalDashboardId}/assign`, {
            user_id: userId,
            permission_type: 'view',
          })
        );

        await Promise.all(assignPromises);
      }

      alert('Dashboard published and assigned successfully!');
      setShowPublishModal(false);
      navigate('/developer/dashboard');
    } catch (e) {
      console.error('Publish error:', e);
      alert(e instanceof Error ? e.message : 'Failed to publish dashboard');
    } finally {
      setPublishing(false);
    }
  };

  const addWidget = (type: Widget['type']) => {
    // If a widget is selected, change its type instead of adding new
    if (selectedWidget) {
      updateWidget(selectedWidget, { 
        type, 
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Chart` 
      });
    } else {
      // Add new widget when no widget is selected
      const newWidget: Widget = {
        id: Date.now().toString(),
        type,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        position: { x: 50, y: 50 },
        size: { 
          width: type === 'filter' ? 250 : type === 'card' ? 280 : 450, 
          height: type === 'filter' ? 200 : type === 'card' ? 180 : 350 
        },
        aggregation: type === 'card' ? 'count' : undefined,
        field: undefined,
        xAxis: undefined, // No default - user must select
        yAxis: undefined, // No default - user must select
        legend: undefined, // No default - user must select
        filterField: type === 'filter' ? undefined : undefined,
        selectedFilters: [],
        datasetId: selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined
      };
      setWidgets([...widgets, newWidget]);
      setSelectedWidget(newWidget.id);
    }
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
    if (selectedWidget === id) {
      setSelectedWidget(null);
    }
  };

  const updateWidgetPosition = (id: string, x: number, y: number) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, position: { x, y } } : w));
  };

  const updateWidgetSize = (id: string, size: { width: number; height: number }) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, size } : w));
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Get data for a widget from its linked dataset
  const getWidgetData = (widget: Widget): unknown[] => {
    if (widget.datasetId && datasetData[widget.datasetId]) {
      return datasetData[widget.datasetId];
    }
    // Fallback to first selected dataset if widget doesn't have one
    if (selectedDatasets.size > 0) {
      const firstDatasetId = Array.from(selectedDatasets)[0];
      return datasetData[firstDatasetId] || [];
    }
    return [];
  };

  const getCardValue = (widget: Widget) => {
    const aggregation = widget.aggregation || 'count';
    const data = getWidgetData(widget);
    
    if (!widget.field || data.length === 0) {
      return '0';
    }
    
    switch (aggregation) {
      case 'count':
        return data.length.toString();
      case 'sum':
        const sum = data.reduce((acc: number, item: any) => {
          const val = Number(item[widget.field!]) || 0;
          return acc + val;
        }, 0);
        return sum.toLocaleString();
      case 'first':
        const first = data[0] as any;
        return first?.[widget.field!]?.toString() || '0';
      case 'last':
        const last = data[data.length - 1] as any;
        return last?.[widget.field!]?.toString() || '0';
      case 'percentage':
        return '85%';
      default:
        return '0';
    }
  };

  const renderWidget = (widget: Widget) => {
    // Get real data from selected dataset
    const widgetData = getWidgetData(widget);
    
    // If no data, show message
    if (widgetData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          {widget.datasetId ? 'No data available' : 'Select a data source and assign columns'}
        </div>
      );
    }

    // Apply legend color mapping if legend field is set
    const hasLegend = widget.legend && widget.legend.length > 0;

    switch (widget.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={widgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={widget.xAxis} stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey={widget.yAxis} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'stacked-bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={widgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={widget.xAxis} stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Legend />
              {widget.yAxis && <Bar dataKey={widget.yAxis} stackId="a" fill="#3b82f6" />}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={widgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={widget.xAxis} stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Legend />
              {widget.yAxis && <Line type="monotone" dataKey={widget.yAxis} stroke="#3b82f6" strokeWidth={2} />}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={widgetData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={widget.xAxis} stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Legend />
              {widget.yAxis && <Area type="monotone" dataKey={widget.yAxis} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />}
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={widgetData}
                dataKey={widget.yAxis || widget.field}
                nameKey={widget.legend || widget.xAxis}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {widgetData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={widgetData}
                dataKey={widget.yAxis || widget.field}
                nameKey={widget.legend || widget.xAxis}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                label
              >
                {widgetData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'treemap':
        if (widgetData.length === 0) {
          return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No data available
            </div>
          );
        }
        // Use real data - map to treemap format
        const treemapData = widgetData.map((item: any, index: number) => ({
          name: item[widget.xAxis || widget.legend || Object.keys(item)[0]] || `Item ${index}`,
          size: Number(item[widget.yAxis || widget.field || Object.keys(item)[1]]) || 0,
          fill: COLORS[index % COLORS.length]
        }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              stroke="#fff"
              fill="#3b82f6"
            >
              <Tooltip />
            </Treemap>
          </ResponsiveContainer>
        );
      case 'gauge':
        const gaugeData = getWidgetData(widget);
        let gaugeValue = 0;
        if (gaugeData.length > 0 && widget.field) {
          const firstItem = gaugeData[0] as any;
          const value = Number(firstItem[widget.field]) || 0;
          // Calculate percentage (assuming max is 100 or use aggregation)
          gaugeValue = widget.aggregation === 'percentage' ? value : Math.min(100, (value / 100) * 100);
        }
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="10"
                  strokeDasharray={`${gaugeValue * 2.827}, 283`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{Math.round(gaugeValue)}%</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">{widget.field || 'Value'}</p>
          </div>
        );
      case 'card':
        return (
          <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">{widget.field || 'Total'}</p>
            <p className="text-5xl font-bold text-indigo-600">{getCardValue(widget)}</p>
            <p className="text-xs text-gray-500 mt-3 capitalize bg-white px-3 py-1 rounded-full">
              {widget.aggregation || 'count'}
            </p>
          </div>
        );
      case 'table':
        if (widgetData.length === 0) {
          return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No data available
            </div>
          );
        }
        const firstRow = widgetData[0] as Record<string, unknown>;
        const tableColumns = Object.keys(firstRow);
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-gray-600 text-xs">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {widgetData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {tableColumns.map((col) => (
                      <td key={col} className="px-3 py-2 text-gray-900 text-xs">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'filter':
        const filterData = getWidgetData(widget);
        const uniqueValues = widget.filterField 
          ? Array.from(new Set(filterData.map((d: any) => d[widget.filterField!])))
          : [];
        
        return (
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-700">{widget.filterField || 'Select field'}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {uniqueValues.length > 0 ? (
                <div className="space-y-2">
                  {uniqueValues.map((value, index) => {
                    const isSelected = widget.selectedFilters?.includes(String(value));
                    return (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentFilters = widget.selectedFilters || [];
                          const newFilters = isSelected
                            ? currentFilters.filter(f => f !== String(value))
                            : [...currentFilters, String(value)];
                          updateWidget(widget.id, { selectedFilters: newFilters });
                          
                          if (widget.filterField) {
                            setGlobalFilters(prev => ({
                              ...prev,
                              [widget.filterField!]: newFilters
                            }));
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-900 font-medium'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded border mr-2 flex items-center justify-center ${
                            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          {String(value)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-500 text-center">
                    Configure filter field<br/>in settings panel
                  </p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const selectedWidgetData = widgets.find(w => w.id === selectedWidget);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/developer/dashboard')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Dashboard Builder</h1>
              <p className="text-xs text-gray-600">
                {selectedWidget 
                  ? "✨ Selected: Click a visual icon to change type, or click canvas to deselect" 
                  : "Click visuals to add • Drag to move • Resize with handles"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Dashboard Name"
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <button
              onClick={() => navigate(`/developer/preview/${dashboardId || 'new'}`)}
              className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </button>
            <button
              onClick={handlePublishClick}
              disabled={publishing}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Publish
            </button>
          </div>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Data Sources & Columns */}
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col">
          {/* Data Sources Section */}
          <div className="border-b border-gray-200">
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center">
                <Database className="w-5 h-5 text-indigo-600 mr-2" />
                <span className="font-semibold text-gray-900">Data</span>
              </div>
            </div>
            <button
              onClick={() => setDataSourcesPanelExpanded(!dataSourcesPanelExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Database className="w-5 h-5 text-indigo-600 mr-2" />
                <span className="font-semibold text-gray-900">Data Sources</span>
              </div>
              {dataSourcesPanelExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {dataSourcesPanelExpanded && (
              <div className="p-4 border-t border-gray-100 max-h-64 overflow-y-auto">
                {loadingDatasets ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                ) : datasets.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No data sources available</p>
                ) : (
                  <div className="space-y-2">
                    {datasets.map((dataset) => (
                      <div
                        key={dataset.id}
                        className={`p-2 border rounded cursor-pointer transition-colors ${
                          selectedDatasets.has(dataset.id)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleDatasetSelection(dataset.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{dataset.name}</p>
                            <p className="text-xs text-gray-500">
                              {dataset.source_type.toUpperCase()} • {dataset.row_count?.toLocaleString() || 0} rows
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedDatasets.has(dataset.id)}
                            onChange={() => toggleDatasetSelection(dataset.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-2 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                        </div>
                        {dataset.connection_status && (
                          <div className="mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              dataset.connection_status === 'connected'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {dataset.connection_status}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columns Section - Show columns from selected data sources */}
          {selectedDatasets.size > 0 && (
            <div className="flex-1 overflow-y-auto border-b border-gray-200">
              <button
                onClick={() => setColumnsPanelExpanded(!columnsPanelExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <Hash className="w-5 h-5 text-indigo-600 mr-2" />
                  <span className="font-semibold text-gray-900">Columns</span>
                </div>
                {columnsPanelExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              
              {columnsPanelExpanded && (
                <div className="p-4 border-t border-gray-100 max-h-96 overflow-y-auto">
                  {Array.from(selectedDatasets).map((datasetId) => {
                    const dataset = datasets.find((d) => d.id === datasetId);
                    const datasetColumns = columns[datasetId] || [];
                    const isLoading = loadingData[datasetId];
                    
                    return (
                      <div key={datasetId} className="mb-4 last:mb-0">
                        <p className="text-xs font-medium text-gray-700 mb-2">{dataset?.name}</p>
                        {isLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          </div>
                        ) : datasetColumns.length === 0 ? (
                          <p className="text-xs text-gray-500">No columns available</p>
                        ) : (
                          <div className="space-y-1">
                            {datasetColumns.map((col) => (
                              <div
                                key={col.name}
                                draggable
                                onDragStart={() => handleDragStart(datasetId, col.name)}
                                onDragEnd={handleDragEnd}
                                className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded cursor-move hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                              >
                                <GripVertical className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-700 flex-1">{col.name}</span>
                                <span className="text-xs text-gray-500">{col.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Middle Sidebar - Visualizations & Configuration */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center">
              <BarChart3 className="w-5 h-5 text-indigo-600 mr-2" />
              <span className="font-semibold text-gray-900">Visuals</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <p className="text-xs text-gray-500 mb-3">Build visual</p>
              
              {/* Visualization Icons Grid */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {visualizationTypes.map((viz) => (
                  <button
                    key={viz.type}
                    onClick={() => addWidget(viz.type)}
                    className={`flex flex-col items-center p-2 border rounded hover:border-indigo-500 hover:bg-indigo-50 transition-all group ${
                      selectedWidgetData?.type === viz.type
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200'
                    }`}
                    title={viz.label}
                  >
                    <viz.icon className={`w-6 h-6 ${viz.color} mb-1`} />
                    <span className="text-[9px] text-gray-600 text-center leading-tight">
                      {viz.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Configuration Panel - Show below visual icons when widget is selected */}
            {selectedWidgetData && (
              <div className="border-t border-gray-200 p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={selectedWidgetData.title}
                    onChange={(e) => updateWidget(selectedWidgetData.id, { title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Card-specific Configuration */}
                {selectedWidgetData.type === 'card' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
                      {selectedDatasets.size > 0 ? (
                        <select 
                          value={selectedWidgetData.field || ''}
                          onChange={(e) => {
                            const datasetId = selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined;
                            updateWidget(selectedWidgetData.id, { 
                              field: e.target.value,
                              datasetId: datasetId || selectedWidgetData.datasetId
                            });
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Select field...</option>
                          {Array.from(selectedDatasets).map((datasetId) => {
                            const dataset = datasets.find((d) => d.id === datasetId);
                            const datasetColumns = columns[datasetId] || [];
                            return (
                              <optgroup key={datasetId} label={dataset?.name || `Dataset ${datasetId}`}>
                                {datasetColumns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-500">Select a data source first</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Aggregation</label>
                      <select 
                        value={selectedWidgetData.aggregation || 'count'}
                        onChange={(e) => updateWidget(selectedWidgetData.id, { aggregation: e.target.value as Widget['aggregation'] })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="count">Count</option>
                        <option value="sum">Sum</option>
                        <option value="first">First Value</option>
                        <option value="last">Last Value</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Filter-specific Configuration */}
                {selectedWidgetData.type === 'filter' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter Field</label>
                    {selectedDatasets.size > 0 ? (
                        <select 
                          value={selectedWidgetData.filterField || ''}
                          onChange={(e) => {
                            const datasetId = selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined;
                            updateWidget(selectedWidgetData.id, { 
                              filterField: e.target.value, 
                              selectedFilters: [],
                              datasetId: datasetId || selectedWidgetData.datasetId
                            });
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Select field...</option>
                          {Array.from(selectedDatasets).map((datasetId) => {
                            const dataset = datasets.find((d) => d.id === datasetId);
                            const datasetColumns = columns[datasetId] || [];
                            return (
                              <optgroup key={datasetId} label={dataset?.name || `Dataset ${datasetId}`}>
                                {datasetColumns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-500">Select a data source first</p>
                      )}
                    <p className="mt-2 text-xs text-gray-500">
                      Shows unique values for filtering
                    </p>
                  </div>
                )}

                {/* Chart Configuration */}
                {!['card', 'gauge', 'filter'].includes(selectedWidgetData.type) && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Y-axis</label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                          handleDrop('yAxis', selectedWidgetData.id);
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded focus-within:border-indigo-500 focus-within:bg-indigo-50 transition-colors min-h-[38px] flex items-center"
                      >
                        {selectedWidgetData.yAxis ? (
                          <span className="text-gray-900">{selectedWidgetData.yAxis}</span>
                        ) : (
                          <span className="text-gray-400">Drag column here or select...</span>
                        )}
                      </div>
                      {selectedDatasets.size > 0 && (
                        <select 
                          value={selectedWidgetData.yAxis || ''}
                          onChange={(e) => {
                            const datasetId = selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined;
                            updateWidget(selectedWidgetData.id, { 
                              yAxis: e.target.value,
                              datasetId: datasetId || selectedWidgetData.datasetId
                            });
                          }}
                          className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Or select from dropdown...</option>
                          {Array.from(selectedDatasets).map((datasetId) => {
                            const dataset = datasets.find((d) => d.id === datasetId);
                            const datasetColumns = columns[datasetId] || [];
                            return (
                              <optgroup key={datasetId} label={dataset?.name || `Dataset ${datasetId}`}>
                                {datasetColumns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">X-axis</label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                          handleDrop('xAxis', selectedWidgetData.id);
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded focus-within:border-indigo-500 focus-within:bg-indigo-50 transition-colors min-h-[38px] flex items-center"
                      >
                        {selectedWidgetData.xAxis ? (
                          <span className="text-gray-900">{selectedWidgetData.xAxis}</span>
                        ) : (
                          <span className="text-gray-400">Drag column here or select...</span>
                        )}
                      </div>
                      {selectedDatasets.size > 0 && (
                        <select 
                          value={selectedWidgetData.xAxis || ''}
                          onChange={(e) => {
                            const datasetId = selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined;
                            updateWidget(selectedWidgetData.id, { 
                              xAxis: e.target.value,
                              datasetId: datasetId || selectedWidgetData.datasetId
                            });
                          }}
                          className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Or select from dropdown...</option>
                          {Array.from(selectedDatasets).map((datasetId) => {
                            const dataset = datasets.find((d) => d.id === datasetId);
                            const datasetColumns = columns[datasetId] || [];
                            return (
                              <optgroup key={datasetId} label={dataset?.name || `Dataset ${datasetId}`}>
                                {datasetColumns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Legend (Categorical Field for Color)
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50');
                          handleDrop('legend', selectedWidgetData.id);
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded focus-within:border-indigo-500 focus-within:bg-indigo-50 transition-colors min-h-[38px] flex items-center"
                      >
                        {selectedWidgetData.legend ? (
                          <span className="text-gray-900">{selectedWidgetData.legend}</span>
                        ) : (
                          <span className="text-gray-400">Drag column here or select...</span>
                        )}
                      </div>
                      {selectedDatasets.size > 0 && (
                        <select 
                          value={selectedWidgetData.legend || ''}
                          onChange={(e) => {
                            const datasetId = selectedDatasets.size > 0 ? Array.from(selectedDatasets)[0] : undefined;
                            updateWidget(selectedWidgetData.id, { 
                              legend: e.target.value,
                              datasetId: datasetId || selectedWidgetData.datasetId
                            });
                          }}
                          className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Or select from dropdown...</option>
                          {Array.from(selectedDatasets).map((datasetId) => {
                            const dataset = datasets.find((d) => d.id === datasetId);
                            const datasetColumns = columns[datasetId] || [];
                            return (
                              <optgroup key={datasetId} label={dataset?.name || `Dataset ${datasetId}`}>
                                {datasetColumns.map((col) => (
                                  <option key={col.name} value={col.name}>
                                    {col.name} ({col.type})
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        Drag a column here or select from dropdown
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Main Canvas */}
        <div
          className="flex-1 p-6 overflow-auto bg-gray-50 relative"
          style={{
            pointerEvents: (showPublishModal || showDetailsModal) ? 'none' : 'auto',
            opacity: (showPublishModal || showDetailsModal) ? 0.3 : 1,
          }}
          onClick={(e) => {
            // Deselect widget when clicking on the canvas background
            if (e.target === e.currentTarget && !showPublishModal && !showDetailsModal) {
              setSelectedWidget(null);
            }
          }}
        >
          {widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="bg-gray-100 p-6 rounded-full mb-4 inline-block">
                  <BarChart3 className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Build Your Dashboard</h3>
                <p className="text-gray-600 mb-1">Click visualizations from the left panel to add</p>
                <p className="text-sm text-gray-500">Drag widgets to position • Resize with corner/edge handles</p>
              </div>
            </div>
          ) : (
            <>
              {widgets.map((widget) => (
                <Draggable
                  key={widget.id}
                  position={{ x: widget.position.x, y: widget.position.y }}
                  onStop={(e, data) => {
                    if (!showPublishModal && !showDetailsModal) {
                      updateWidgetPosition(widget.id, data.x, data.y);
                    }
                  }}
                  handle=".drag-handle"
                  grid={[1, 1]}
                  bounds="parent"
                  disabled={showPublishModal || showDetailsModal}
                >
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: (showPublishModal || showDetailsModal) ? 0 : (selectedWidget === widget.id ? 1000 : 1),
                      pointerEvents: (showPublishModal || showDetailsModal) ? 'none' : 'auto',
                      opacity: (showPublishModal || showDetailsModal) ? 0.3 : 1,
                    }}
                  >
                    <Resizable
                      size={{ width: widget.size.width, height: widget.size.height }}
                      onResizeStop={(e, direction, ref, d) => {
                        const newWidth = widget.size.width + d.width;
                        const newHeight = widget.size.height + d.height;
                        
                        // Update size
                        updateWidgetSize(widget.id, {
                          width: newWidth,
                          height: newHeight
                        });
                        
                        // Update position based on resize direction
                        let newX = widget.position.x;
                        let newY = widget.position.y;
                        
                        // If resizing from left side, move position left by the width delta
                        if (direction.includes('left')) {
                          newX = widget.position.x - d.width;
                        }
                        
                        // If resizing from top side, move position up by the height delta
                        if (direction.includes('top')) {
                          newY = widget.position.y - d.height;
                        }
                        
                        // Update position if it changed
                        if (newX !== widget.position.x || newY !== widget.position.y) {
                          updateWidgetPosition(widget.id, newX, newY);
                        }
                      }}
                      minWidth={150}
                      minHeight={120}
                      enable={{
                        top: true,
                        right: true,
                        bottom: true,
                        left: true,
                        topRight: true,
                        topLeft: true,
                        bottomRight: true,
                        bottomLeft: true
                      }}
                      handleStyles={{
                        top: { 
                          height: '6px',
                          width: '30px',
                          top: '-3px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          cursor: 'ns-resize',
                          zIndex: 20,
                          borderRadius: '2px'
                        },
                        right: { 
                          width: '6px',
                          height: '30px',
                          right: '-3px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          cursor: 'ew-resize',
                          zIndex: 20,
                          borderRadius: '2px'
                        },
                        bottom: { 
                          height: '6px',
                          width: '30px',
                          bottom: '-3px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          cursor: 'ns-resize',
                          zIndex: 20,
                          borderRadius: '2px'
                        },
                        left: { 
                          width: '6px',
                          height: '30px',
                          left: '-3px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          cursor: 'ew-resize',
                          zIndex: 20,
                          borderRadius: '2px'
                        },
                        topRight: { 
                          width: '10px', 
                          height: '10px', 
                          top: '-5px', 
                          right: '-5px',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          border: selectedWidget === widget.id ? '1px solid white' : 'none',
                          cursor: 'nesw-resize',
                          zIndex: 30,
                          borderRadius: '2px'
                        },
                        topLeft: { 
                          width: '10px', 
                          height: '10px', 
                          top: '-5px', 
                          left: '-5px',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          border: selectedWidget === widget.id ? '1px solid white' : 'none',
                          cursor: 'nwse-resize',
                          zIndex: 30,
                          borderRadius: '2px'
                        },
                        bottomRight: { 
                          width: '10px', 
                          height: '10px', 
                          bottom: '-5px', 
                          right: '-5px',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          border: selectedWidget === widget.id ? '1px solid white' : 'none',
                          cursor: 'nwse-resize',
                          zIndex: 30,
                          borderRadius: '2px'
                        },
                        bottomLeft: { 
                          width: '10px', 
                          height: '10px', 
                          bottom: '-5px', 
                          left: '-5px',
                          background: selectedWidget === widget.id ? '#4f46e5' : 'transparent',
                          border: selectedWidget === widget.id ? '1px solid white' : 'none',
                          cursor: 'nesw-resize',
                          zIndex: 30,
                          borderRadius: '2px'
                        }
                      }}
                    >
                      <div
                        onClick={() => setSelectedWidget(widget.id)}
                        className={`bg-white h-full relative transition-all ${
                          selectedWidget === widget.id ? 'shadow-lg' : 'hover:shadow-md'
                        }`}
                        style={{
                          boxShadow: selectedWidget === widget.id 
                            ? '0 0 0 1.5px #6366f1, 0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                          border: 'none'
                        }}
                      >
                        {/* Widget Header with Drag Handle */}
                        <div className="drag-handle flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-move bg-gray-50">
                          <div className="flex items-center">
                            <GripVertical className="w-4 h-4 text-gray-400 mr-2" />
                            <h4 className="font-medium text-gray-900 text-sm">{widget.title}</h4>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeWidget(widget.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Widget Content */}
                        <div className="h-[calc(100%-44px)] p-3">
                          {renderWidget(widget)}
                        </div>
                      </div>
                    </Resizable>
                  </div>
                </Draggable>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Dashboard Details Modal for New Dashboards */}
      <DashboardDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setPendingAction(null);
        }}
        onSave={handleDetailsSave}
        initialName={dashboardName}
        initialCategory={dashboardCategory}
        initialDescription={dashboardDescription}
        saving={saving}
      />

      {/* User Assignment Modal for Publishing */}
      <UserAssignmentModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublishConfirm}
        dashboardId={dashboardId}
        publishing={publishing}
        dashboardName={dashboardName}
      />
    </div>
  );
}