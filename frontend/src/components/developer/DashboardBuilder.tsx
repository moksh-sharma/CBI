import { useState, useRef, createRef, useEffect, useCallback } from 'react';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table as TableIcon, Save, Eye, ArrowLeft, Activity, Target, Gauge, Grid3x3, X, ChevronRight, ChevronDown, Layers, Hash, Filter as FilterIcon, GripVertical, Database, Loader2, CheckCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import Draggable from 'react-draggable';
import { Resizable } from 're-resizable';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../lib/themeColors';
import { validateChartConfig } from '../../lib/chartRegistry';
import { ChartRenderer, type ChartWidgetConfig } from '../charts/ChartRenderer';
import UserAssignmentModal from './UserAssignmentModal';
import DashboardDetailsModal from './DashboardDetailsModal';

interface Widget {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'table' | 'stacked-bar' | 'area' | 'donut' | 'treemap' | 'gauge' | 'card' | 'filter';
  title: string;
  dataKey?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  /**
   * PowerBI-like semantic aggregation for visuals.
   * - Charts: aggregates Values (yAxis/field) by X-axis (and Legend when relevant)
   * - Cards: aggregates single Field
   */
  aggregation?: 'count' | 'sum' | 'first' | 'last' | 'percentage';
  field?: string;
  xAxis?: string;
  yAxis?: string;
  legend?: string;
  filterField?: string;
  selectedFilters?: string[];
  datasetId?: number; // Link widget to a data source
  /**
   * Visual accent (used for KPI/format accents). Charts use shared PowerBI palette.
   */
  accentColor?: string;
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
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
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
  const [fieldSearch, setFieldSearch] = useState('');
  const [rightTab, setRightTab] = useState<'visualizations' | 'fields' | 'format'>('fields');
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const rightPanelScrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  // Canva-like canvas: zoom, pan, expandable stage
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const hasPannedRef = useRef(false);

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

  // Track viewport size for fit-to-view and canvas layout
  useEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => setViewportSize({ w: el.clientWidth || 0, h: el.clientHeight || 0 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pan: attach window mousemove/mouseup when isPanning
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const s = panStartRef.current;
      if (s) {
        setPan((p) => ({ x: s.offX + e.clientX - s.x, y: s.offY + e.clientY - s.y }));
        hasPannedRef.current = true;
      }
    };
    const onUp = (e: MouseEvent) => {
      // Only deselect when releasing *inside* the canvas. Releasing over Format/sidebar must not deselect.
      const inCanvas = canvasRef.current?.contains(e.target as Node);
      if (!hasPannedRef.current && inCanvas) setSelectedWidget(null);
      panStartRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  // Wheel zoom (non-passive so preventDefault works)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(2, Math.max(0.15, z + d)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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

  /** Chart types shown in visualization panel. Registry-driven; icons mapped locally. */
  const vizPanelTypes: { type: Widget['type']; icon: typeof BarChart3; label: string; color: string }[] = [
    { type: 'bar', icon: BarChart3, label: 'Bar', color: 'text-blue-600' },
    { type: 'stacked-bar', icon: Layers, label: 'Stacked Bar', color: 'text-blue-600' },
    { type: 'line', icon: LineChartIcon, label: 'Line', color: 'text-green-600' },
    { type: 'area', icon: Activity, label: 'Area', color: 'text-purple-600' },
    { type: 'pie', icon: PieChartIcon, label: 'Pie', color: 'text-orange-600' },
    { type: 'donut', icon: Target, label: 'Donut', color: 'text-pink-600' },
    { type: 'treemap', icon: Grid3x3, label: 'Treemap', color: 'text-teal-600' },
    { type: 'gauge', icon: Gauge, label: 'Gauge', color: 'text-indigo-600' },
    { type: 'card', icon: Hash, label: 'Card', color: 'text-cyan-600' },
    { type: 'filter', icon: FilterIcon, label: 'Slicer', color: 'text-red-600' },
    { type: 'table', icon: TableIcon, label: 'Table', color: 'text-gray-600' },
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

  type FieldBucket = 'xAxis' | 'yAxis' | 'legend' | 'field' | 'filterField';

  const handleDrop = (target: FieldBucket, widgetId: string) => {
    if (!draggedColumn || !selectedWidget) return;

    const columnName = draggedColumn.columnName;
    const updates: Partial<Widget> = {};

    if (target === 'xAxis') {
      updates.xAxis = columnName;
    } else if (target === 'yAxis') {
      updates.yAxis = columnName;
    } else if (target === 'legend') {
      updates.legend = columnName;
    } else if (target === 'field') {
      updates.field = columnName;
    } else if (target === 'filterField') {
      updates.filterField = columnName;
      updates.selectedFilters = [];
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
        configVersion: 1,
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
        configVersion: 1,
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
      const size = {
        width: type === 'filter' ? 250 : type === 'card' ? 280 : 450,
        height: type === 'filter' ? 200 : type === 'card' ? 180 : 350
      };
      const position = findNextFreePosition(size);
      const newWidget: Widget = {
        id: Date.now().toString(),
        type,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        position,
        size,
        aggregation: type === 'card' ? 'count' : 'sum',
        field: undefined,
        xAxis: undefined, // No default - user must select
        yAxis: undefined, // No default - user must select
        legend: undefined, // No default - user must select
        filterField: type === 'filter' ? undefined : undefined,
        selectedFilters: [],
        datasetId: selectedDatasets.size > 0 ? (Array.from(selectedDatasets)[0] as number) : undefined,
        accentColor: '#118DFF', // PowerBI-ish default
      };
      setWidgets([...widgets, newWidget]);
      setSelectedWidget(newWidget.id);
      setRightTab('fields');
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

  /**
   * Dashboard JSON schema (stored in backend dashboard config today)
   * ------------------------------------------------------------
   * {
   *   widgets: Widget[],
   *   selectedDatasets: number[],
   *   category?: string
   * }
   *
   * Widget highlights:
   * - position/size => layout (canvas)
   * - datasetId => binding
   * - xAxis/yAxis/legend/field/filterField => PowerBI-like buckets
   * - aggregation => semantic aggregation (sum/count/etc)
   */
  const COLORS = ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#00B7C3', '#744EC2', '#D64550', '#7FBA00'];
  const GRID_SIZE = 10;
  const CANVAS_PADDING = 20;
  const STAGE_WIDTH = 4000;
  const STAGE_HEIGHT = 3000;

  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, []);

  const rectsOverlap = useCallback(
    (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },
    []
  );

  /**
   * PowerBI-like auto-layout:
   * When adding a new visual, find the next free slot on the canvas (grid-snapped)
   * so visuals never overlap. If the row is full, it places the visual below.
   */
  const findNextFreePosition = useCallback(
    (newSize: { width: number; height: number }) => {
      const usableWidth = Math.max(0, STAGE_WIDTH - CANVAS_PADDING * 2);
      const maxY = STAGE_HEIGHT - CANVAS_PADDING - newSize.height;
      const step = GRID_SIZE;
      const pad = 12;

      const maxX = Math.max(CANVAS_PADDING, CANVAS_PADDING + usableWidth - newSize.width);
      const existing = widgets.map((it) => ({
        x: it.position.x - pad,
        y: it.position.y - pad,
        w: it.size.width + pad * 2,
        h: it.size.height + pad * 2,
      }));

      let y = CANVAS_PADDING;
      const safetyMaxRows = 600;
      for (let row = 0; row < safetyMaxRows; row++) {
        if (y + newSize.height > STAGE_HEIGHT - CANVAS_PADDING) break;
        for (let x = CANVAS_PADDING; x <= maxX; x += step) {
          const candidate = { x, y, w: newSize.width, h: newSize.height };
          const overlaps = existing.some((r) => rectsOverlap(candidate, r));
          if (!overlaps) return { x: snapToGrid(x), y: snapToGrid(y) };
        }
        const bottoms = existing.map((r) => r.y + r.h);
        const nextY = bottoms.length > 0 ? Math.min(...bottoms.filter((b) => b > y + 1)) : y + newSize.height + pad;
        y = snapToGrid(Number.isFinite(nextY) ? nextY : y + newSize.height + pad);
      }

      const maxBottom = widgets.reduce((m, it) => Math.max(m, it.position.y + it.size.height), 0);
      const fallbackY = Math.min(snapToGrid(maxBottom + pad), Math.max(CANVAS_PADDING, maxY));
      return { x: CANVAS_PADDING, y: fallbackY };
    },
    [CANVAS_PADDING, GRID_SIZE, STAGE_WIDTH, STAGE_HEIGHT, rectsOverlap, snapToGrid, widgets]
  );

  const applyGlobalFilters = useCallback(
    (rows: unknown[]) => {
      const filters = globalFilters || {};
      const keys = Object.keys(filters);
      if (keys.length === 0) return rows;
      return rows.filter((r: any) => {
        if (!r || typeof r !== 'object') return false;
        for (const k of keys) {
          const allowed = filters[k];
          if (!allowed || allowed.length === 0) continue;
          const v = r[k];
          if (!allowed.includes(String(v))) return false;
        }
        return true;
      });
    },
    [globalFilters]
  );

  // Get data for a widget from its linked dataset (then apply cross-filters like PowerBI)
  const getWidgetData = useCallback(
    (widget: Widget): unknown[] => {
      let rows: unknown[] = [];
      if (widget.datasetId && datasetData[widget.datasetId]) {
        rows = datasetData[widget.datasetId];
      } else if (selectedDatasets.size > 0) {
        const firstDatasetId = Array.from(selectedDatasets)[0];
        rows = datasetData[firstDatasetId] || [];
      }
      return applyGlobalFilters(rows);
    },
    [applyGlobalFilters, datasetData, selectedDatasets]
  );

  const renderWidget = (widget: Widget) => {
    const rawRows = getWidgetData(widget);
    const mode = isDark ? 'dark' : 'light';
    const config: ChartWidgetConfig = {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      position: widget.position,
      size: widget.size,
      aggregation: widget.aggregation,
      field: widget.field,
      xAxis: widget.xAxis,
      yAxis: widget.yAxis,
      legend: widget.legend,
      filterField: widget.filterField,
      selectedFilters: widget.selectedFilters,
      datasetId: widget.datasetId,
      accentColor: widget.accentColor,
    };
    const onSlicerChange =
      widget.type === 'filter' && widget.filterField
        ? (value: string, selected: boolean) => {
          const current = widget.selectedFilters || [];
          const newFilters = selected ? [...current, value] : current.filter((f) => f !== value);
          updateWidget(widget.id, { selectedFilters: newFilters });
          setGlobalFilters((prev) => ({ ...prev, [widget.filterField!]: newFilters }));
        }
        : undefined;
    return ChartRenderer(config, rawRows, { mode, onSlicerChange });
  };

  const selectedWidgetData = widgets.find(w => w.id === selectedWidget);

  const BucketDropZone = ({
    label,
    value,
    bucket,
    widgetId,
    hint,
    onClear,
  }: {
    label: string;
    value?: string;
    bucket: FieldBucket;
    widgetId: string;
    hint?: string;
    onClear?: () => void;
  }) => {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label style={{ color: colors.text }} className="block text-xs font-medium">
            {label}
          </label>
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] hover:underline"
              style={{ color: colors.muted }}
            >
              Clear
            </button>
          )}
        </div>
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
            handleDrop(bucket, widgetId);
          }}
          style={{
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.text
          }}
          className="w-full px-3 py-2 text-sm border-2 border-dashed rounded-lg focus-within:border-indigo-500 transition-colors min-h-[40px] flex items-center"
        >
          {value ? (
            <span style={{ color: colors.text }} className="text-sm">{value}</span>
          ) : (
            <span style={{ color: colors.muted }} className="text-sm">{hint || 'Drag field here'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: colors.bg }} className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <div style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }} className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/developer/dashboard')}
              style={{ color: colors.text }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 style={{ color: colors.text }} className="text-xl font-semibold">Dashboard Builder</h1>
              <p style={{ color: colors.muted }} className="text-xs">
                {selectedWidget
                  ? "✨ Selected: Change type in Build, or click canvas to deselect"
                  : "Scroll to zoom • Drag background to pan • Add visuals • Drag to move • Resize with handles"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Dashboard Name"
              style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
              className="px-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <button
              onClick={() => navigate(`/developer/preview/${dashboardId || 'new'}`)}
              style={{ color: colors.text }}
              className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm"
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
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar - Data Sources & Columns */}
          <Panel defaultSize={22} minSize={16} maxSize={34}>
            <div style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }} className="h-full border-r flex flex-col">
              {/* Data Sources Section */}
              <div style={{ borderColor: colors.cardBorder }} className="border-b">
                <div
                  className="px-4 py-3 border-b"
                  style={{
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.10)' : 'rgba(99, 102, 241, 0.08)',
                    borderColor: colors.cardBorder,
                  }}
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 text-indigo-600 mr-2" />
                    <span style={{ color: colors.text }} className="font-semibold">Data</span>
                  </div>
                </div>
                <button
                  onClick={() => setDataSourcesPanelExpanded(!dataSourcesPanelExpanded)}
                  style={{ color: colors.text }}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center">
                    <Database className="w-5 h-5 text-indigo-600 mr-2" />
                    <span className="font-semibold">Data Sources</span>
                  </div>
                  {dataSourcesPanelExpanded ? (
                    <ChevronDown className="w-4 h-4" style={{ color: colors.muted }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: colors.muted }} />
                  )}
                </button>

                {dataSourcesPanelExpanded && (
                  <div style={{ borderColor: colors.cardBorder }} className="p-4 border-t max-h-64 overflow-y-auto">
                    {loadingDatasets ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      </div>
                    ) : datasets.length === 0 ? (
                      <p style={{ color: colors.muted }} className="text-xs text-center py-4">No data sources available</p>
                    ) : (
                      <div className="space-y-2">
                        {datasets.map((dataset) => (
                          <div
                            key={dataset.id}
                            style={{
                              backgroundColor: selectedDatasets.has(dataset.id) ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff') : colors.cardBg,
                              borderColor: selectedDatasets.has(dataset.id) ? '#6366f1' : colors.cardBorder
                            }}
                            className="p-2 border rounded cursor-pointer transition-colors"
                            onClick={() => toggleDatasetSelection(dataset.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p style={{ color: colors.text }} className="text-sm font-medium truncate">{dataset.name}</p>
                                <p style={{ color: colors.muted }} className="text-xs">
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
                                <span className={`text-xs px-2 py-0.5 rounded ${dataset.connection_status === 'connected'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
                <div style={{ borderColor: colors.cardBorder }} className="flex-1 overflow-y-auto border-b">
                  <button
                    onClick={() => setColumnsPanelExpanded(!columnsPanelExpanded)}
                    style={{ color: colors.text }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center">
                      <Hash className="w-5 h-5 text-indigo-600 mr-2" />
                      <span className="font-semibold">Columns</span>
                    </div>
                    {columnsPanelExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: colors.muted }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: colors.muted }} />
                    )}
                  </button>

                  {columnsPanelExpanded && (
                    <div style={{ borderColor: colors.cardBorder }} className="p-4 border-t max-h-96 overflow-y-auto">
                      <div className="mb-3">
                        <input
                          value={fieldSearch}
                          onChange={(e) => setFieldSearch(e.target.value)}
                          placeholder="Search fields..."
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                        />
                      </div>
                      {Array.from(selectedDatasets).map((datasetId) => {
                        const dataset = datasets.find((d) => d.id === datasetId);
                        const datasetColumns = (columns[datasetId] || []).filter((c) =>
                          fieldSearch.trim()
                            ? c.name.toLowerCase().includes(fieldSearch.trim().toLowerCase())
                            : true
                        );
                        const isLoading = loadingData[datasetId];

                        return (
                          <div key={datasetId} className="mb-4 last:mb-0">
                            <p style={{ color: colors.text }} className="text-xs font-medium mb-2">{dataset?.name}</p>
                            {isLoading ? (
                              <div className="flex items-center justify-center py-2">
                                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                              </div>
                            ) : datasetColumns.length === 0 ? (
                              <p style={{ color: colors.muted }} className="text-xs">No columns available</p>
                            ) : (
                              <div className="space-y-1">
                                {datasetColumns.map((col) => (
                                  <div
                                    key={col.name}
                                    draggable
                                    onDragStart={() => handleDragStart(datasetId as number, col.name)}
                                    onDragEnd={handleDragEnd}
                                    style={{
                                      backgroundColor: colors.inputBg,
                                      borderColor: colors.inputBorder,
                                    }}
                                    className="flex items-center gap-2 p-2 border rounded cursor-move hover:border-indigo-300 transition-colors"
                                    onMouseEnter={(e) => {
                                      (e.currentTarget as HTMLDivElement).style.backgroundColor = isDark
                                        ? 'rgba(99, 102, 241, 0.12)'
                                        : 'rgba(99, 102, 241, 0.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                      (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.inputBg;
                                    }}
                                  >
                                    <GripVertical className="w-4 h-4" style={{ color: colors.muted }} />
                                    <span style={{ color: colors.text }} className="text-xs flex-1">{col.name}</span>
                                    <span style={{ color: colors.muted }} className="text-xs">{col.type}</span>
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
          </Panel>

          <PanelResizeHandle className="w-1 bg-transparent hover:bg-indigo-500/30 transition-colors" />

          {/* Main Canvas - Canva-like: zoom, pan, expandable stage */}
          <Panel defaultSize={56} minSize={40}>
            <div
              ref={canvasRef}
              className="h-full overflow-hidden relative"
              style={{
                backgroundColor: isDark ? '#0f0f14' : '#e5e7eb',
                pointerEvents: (showPublishModal || showDetailsModal) ? 'none' : 'auto',
                opacity: (showPublishModal || showDetailsModal) ? 0.3 : 1,
                cursor: isPanning ? 'grabbing' : 'default',
              }}
            >
              {/* Stage: large pannable/zoomable area */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: STAGE_WIDTH,
                  height: STAGE_HEIGHT,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {/* Background: dotted pattern, drag to pan, click to deselect */}
                <div
                  role="presentation"
                  className="absolute inset-0"
                  style={{
                    backgroundImage: isDark
                      ? 'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)'
                      : 'radial-gradient(rgba(107, 114, 128, 0.18) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                    cursor: 'grab',
                  }}
                  onMouseDown={(e) => {
                    if (showPublishModal || showDetailsModal) return;
                    hasPannedRef.current = false;
                    panStartRef.current = { x: e.clientX, y: e.clientY, offX: pan.x, offY: pan.y };
                    setIsPanning(true);
                  }}
                />
                {widgets.length === 0 ? (
                  <div
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%' }}
                  >
                    <div className="text-center">
                      <div style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6' }} className="p-6 rounded-full mb-4 inline-block">
                        <BarChart3 className="w-16 h-16" style={{ color: colors.muted }} />
                      </div>
                      <h3 style={{ color: colors.text }} className="text-lg font-medium mb-2">Build Your Dashboard</h3>
                      <p style={{ color: colors.muted }} className="mb-1">Click visualizations from the left panel to add</p>
                      <p style={{ color: colors.muted }} className="text-sm">Scroll to zoom • Drag background to pan • Drag widgets to move • Resize with handles</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {widgets.map((widget) => (
                      <Draggable
                        key={widget.id}
                        position={{ x: widget.position.x, y: widget.position.y }}
                        onStop={(e, data) => {
                          if (showPublishModal || showDetailsModal) return;
                          const rx = Math.max(0, Math.min(STAGE_WIDTH - widget.size.width, snapToGrid(data.x)));
                          const ry = Math.max(0, Math.min(STAGE_HEIGHT - widget.size.height, snapToGrid(data.y)));
                          updateWidgetPosition(widget.id, rx, ry);
                        }}
                        handle=".drag-handle"
                        grid={[GRID_SIZE, GRID_SIZE]}
                        bounds={{ left: 0, top: 0, right: STAGE_WIDTH - widget.size.width, bottom: STAGE_HEIGHT - widget.size.height }}
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
                              const newWidth = snapToGrid(widget.size.width + d.width);
                              const newHeight = snapToGrid(widget.size.height + d.height);

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
                                newX = snapToGrid(widget.position.x - d.width);
                              }

                              // If resizing from top side, move position up by the height delta
                              if (direction.includes('top')) {
                                newY = snapToGrid(widget.position.y - d.height);
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
                              className="h-full relative transition-all"
                              style={{
                                backgroundColor: colors.cardBg,
                                boxShadow: selectedWidget === widget.id
                                  ? '0 0 0 1.5px #6366f1, 0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                  : colors.cardShadow,
                                border: 'none',
                                borderRadius: 12,
                                overflow: 'hidden',
                              }}
                            >
                              {/* Widget Header with Drag Handle */}
                              <div
                                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', borderColor: colors.cardBorder }}
                                className="drag-handle flex items-center justify-between px-3 py-2 border-b cursor-move"
                              >
                                <div className="flex items-center">
                                  <GripVertical className="w-4 h-4 mr-2" style={{ color: colors.muted }} />
                                  <h4 style={{ color: colors.text }} className="font-medium text-sm">{widget.title}</h4>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeWidget(widget.id);
                                  }}
                                  className="p-1 hover:text-red-600 transition-colors"
                                  style={{ color: colors.muted }}
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
              {/* Zoom controls - fixed in viewport */}
              <div
                className="absolute bottom-4 right-4 z-50 flex items-center gap-1 rounded-lg border shadow-lg"
                style={{
                  backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
                  borderColor: colors.cardBorder,
                }}
              >
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.15, z / 1.25))}
                  className="p-2 hover:opacity-80 transition-opacity"
                  style={{ color: colors.text }}
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const vw = viewportSize.w || 800;
                    const vh = viewportSize.h || 600;
                    const z = Math.min(2, Math.max(0.15, Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT) * 0.9));
                    setZoom(z);
                    setPan({ x: (vw - STAGE_WIDTH * z) / 2, y: (vh - STAGE_HEIGHT * z) / 2 });
                  }}
                  className="p-2 hover:opacity-80 transition-opacity"
                  style={{ color: colors.text }}
                  title="Fit to view"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <span style={{ color: colors.muted }} className="px-2 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2, z * 1.25))}
                  className="p-2 hover:opacity-80 transition-opacity"
                  style={{ color: colors.text }}
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-transparent hover:bg-indigo-500/30 transition-colors" />

          {/* Right Sidebar - PowerBI-like Visualizations + Fields/Format */}
          <Panel defaultSize={22} minSize={16} maxSize={34}>
            <div style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }} className="h-full border-l flex flex-col">
              <div
                className="px-4 pt-3 pb-2 border-b"
                style={{
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.10)' : 'rgba(99, 102, 241, 0.08)',
                  borderColor: colors.cardBorder,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BarChart3 className="w-5 h-5 text-indigo-600 mr-2" />
                    <span style={{ color: colors.text }} className="font-semibold">Visual</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['visualizations', 'fields', 'format'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRightTab(t);
                          rightPanelScrollRef.current?.scrollTo(0, 0);
                        }}
                        className="px-2 py-1 rounded-md text-xs transition-colors"
                        style={{
                          color: colors.text,
                          backgroundColor:
                            rightTab === t ? (isDark ? 'rgba(99, 102, 241, 0.28)' : 'rgba(99, 102, 241, 0.14)') : (isDark ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255,255,255,0.55)'),
                          border: rightTab === t ? '1px solid rgba(99,102,241,0.55)' : '1px solid transparent',
                        }}
                      >
                        {t === 'visualizations' ? 'Build' : t === 'fields' ? 'Fields' : 'Format'}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ color: colors.muted }} className="text-xs mt-2">
                  {rightTab === 'visualizations'
                    ? 'Add a visual (or change selected)'
                    : rightTab === 'fields'
                      ? 'Drag fields into buckets'
                      : 'Style & aggregation'}
                </p>
              </div>

              <div ref={rightPanelScrollRef} className="flex-1 overflow-y-auto">
                {rightTab === 'visualizations' && (
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {vizPanelTypes.map((viz) => (
                        <button
                          key={viz.type}
                          onClick={() => addWidget(viz.type)}
                          style={{
                            backgroundColor: selectedWidgetData?.type === viz.type ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff') : colors.cardBg,
                            borderColor: selectedWidgetData?.type === viz.type ? '#6366f1' : colors.cardBorder
                          }}
                          className="flex flex-col items-center p-2 border rounded-lg hover:border-indigo-500 transition-all group"
                          title={viz.label}
                        >
                          <viz.icon className={`w-6 h-6 ${viz.color} mb-1`} />
                          <span style={{ color: colors.muted }} className="text-[9px] text-center leading-tight">
                            {viz.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(rightTab === 'fields' || rightTab === 'format') && (
                  <div style={{ borderColor: colors.cardBorder }} className="border-t p-4 space-y-4">
                    {!selectedWidgetData ? (
                      <div className="py-6 text-center">
                        <p style={{ color: colors.muted }} className="text-xs">
                          Select a visual on the canvas to configure.
                        </p>
                      </div>
                    ) : (
                      <>
                        {rightTab === 'fields' && (
                          <>
                            {/* Dataset binding */}
                            <div>
                              <label style={{ color: colors.text }} className="block text-xs font-medium mb-1">Dataset</label>
                              <select
                                value={selectedWidgetData.datasetId || ''}
                                onChange={(e) => updateWidget(selectedWidgetData.id, { datasetId: Number(e.target.value) || undefined })}
                                style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              >
                                <option value="" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                  Select dataset...
                                </option>
                                {Array.from(selectedDatasets).map((datasetId) => {
                                  const dataset = datasets.find((d) => d.id === datasetId);
                                  return (
                                    <option key={datasetId} value={datasetId} style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>
                                      {dataset?.name || `Dataset ${datasetId}`}
                                    </option>
                                  );
                                })}
                              </select>
                              <p style={{ color: colors.muted }} className="text-[11px] mt-2">
                                Drag fields from the left “Columns” panel into buckets below.
                              </p>
                            </div>

                            {/* Validation errors (Power BI–like) */}
                            {(() => {
                              const errs = validateChartConfig(selectedWidgetData.type, {
                                xAxis: selectedWidgetData.xAxis,
                                yAxis: selectedWidgetData.yAxis,
                                legend: selectedWidgetData.legend,
                                field: selectedWidgetData.field,
                                filterField: selectedWidgetData.filterField,
                              });
                              if (errs.length === 0) return null;
                              return (
                                <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2', color: '#dc2626' }}>
                                  {errs.map((e, i) => (
                                    <p key={i}>{e}</p>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Buckets */}
                            {!['card', 'gauge', 'filter'].includes(selectedWidgetData.type) && (
                              <>
                                <BucketDropZone
                                  label="X-axis"
                                  value={selectedWidgetData.xAxis}
                                  bucket="xAxis"
                                  widgetId={selectedWidgetData.id}
                                  hint="Drag category field here"
                                  onClear={() => updateWidget(selectedWidgetData.id, { xAxis: undefined })}
                                />
                                <BucketDropZone
                                  label="Values"
                                  value={selectedWidgetData.yAxis || selectedWidgetData.field}
                                  bucket="yAxis"
                                  widgetId={selectedWidgetData.id}
                                  hint="Drag numeric field here"
                                  onClear={() => updateWidget(selectedWidgetData.id, { yAxis: undefined, field: undefined })}
                                />
                                <BucketDropZone
                                  label="Legend"
                                  value={selectedWidgetData.legend}
                                  bucket="legend"
                                  widgetId={selectedWidgetData.id}
                                  hint="Optional: drag category field here"
                                  onClear={() => updateWidget(selectedWidgetData.id, { legend: undefined })}
                                />
                              </>
                            )}

                            {selectedWidgetData.type === 'card' && (
                              <BucketDropZone
                                label="Field"
                                value={selectedWidgetData.field}
                                bucket="field"
                                widgetId={selectedWidgetData.id}
                                hint="Drag a field for KPI"
                                onClear={() => updateWidget(selectedWidgetData.id, { field: undefined })}
                              />
                            )}

                            {selectedWidgetData.type === 'filter' && (
                              <BucketDropZone
                                label="Filter field"
                                value={selectedWidgetData.filterField}
                                bucket="filterField"
                                widgetId={selectedWidgetData.id}
                                hint="Drag a field to filter other visuals"
                                onClear={() => updateWidget(selectedWidgetData.id, { filterField: undefined, selectedFilters: [] })}
                              />
                            )}
                          </>
                        )}

                        {rightTab === 'format' && (
                          <>
                            <div className="mb-1">
                              <span style={{ color: colors.text }} className="text-xs font-semibold">Style & aggregation</span>
                            </div>

                            <div>
                              <label style={{ color: colors.text }} className="block text-xs font-medium mb-1">Title</label>
                              <input
                                type="text"
                                value={selectedWidgetData.title ?? ''}
                                onChange={(e) => updateWidget(selectedWidgetData.id, { title: e.target.value })}
                                placeholder="Chart title"
                                style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                              />
                            </div>

                            {!['table', 'filter'].includes(selectedWidgetData.type) && (
                              <div>
                                <label style={{ color: colors.text }} className="block text-xs font-medium mb-1">Aggregation</label>
                                <select
                                  value={selectedWidgetData.aggregation || 'sum'}
                                  onChange={(e) => updateWidget(selectedWidgetData.id, { aggregation: e.target.value as Widget['aggregation'] })}
                                  style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                  <option value="sum" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Sum</option>
                                  <option value="count" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Count</option>
                                  <option value="first" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>First</option>
                                  <option value="last" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Last</option>
                                  <option value="percentage" style={{ backgroundColor: isDark ? '#1a1a2e' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Percentage</option>
                                </select>
                                <p style={{ color: colors.muted }} className="text-[11px] mt-2">
                                  Charts aggregate Values by X-axis (and Legend when set).
                                </p>
                              </div>
                            )}

                            <div>
                              <label style={{ color: colors.text }} className="block text-xs font-medium mb-2">Accent color</label>
                              <div className="flex flex-wrap gap-2">
                                {COLORS.map((c) => {
                                  const isSelected = (selectedWidgetData.accentColor || '#118DFF') === c;
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => updateWidget(selectedWidgetData.id, { accentColor: c })}
                                      className="h-8 w-8 rounded-md border flex-shrink-0 transition-all"
                                      style={{
                                        backgroundColor: c,
                                        borderColor: isSelected ? '#6366f1' : colors.cardBorder,
                                        boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none',
                                      }}
                                      title={c}
                                      aria-label={`Accent color ${c}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
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