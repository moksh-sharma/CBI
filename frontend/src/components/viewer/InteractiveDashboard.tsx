import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, Search, Filter, Calendar, Loader2 } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { renderWidget, Widget } from '../shared/WidgetRenderer';

export default function InteractiveDashboard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [globalSearch, setGlobalSearch] = useState('');
  const [dateRange, setDateRange] = useState('last-30-days');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [datasetData, setDatasetData] = useState<Record<number, unknown[]>>({});
  const [loadingData, setLoadingData] = useState<Record<number, boolean>>({});

  const fetchDatasetData = useCallback(async (datasetId: number) => {
    if (loadingData[datasetId] || datasetData[datasetId]) return;
    
    setLoadingData((prev) => ({ ...prev, [datasetId]: true }));
    try {
      const res = await apiGet<{ data: unknown[]; schema: any }>(`/api/data/datasets/${datasetId}`);
      if (res.success && res.data) {
        const data = (res.data as any).data || [];
        setDatasetData((prev) => ({ ...prev, [datasetId]: data }));
      }
    } catch (e) {
      console.error(`Failed to fetch dataset ${datasetId}:`, e);
    } finally {
      setLoadingData((prev) => ({ ...prev, [datasetId]: false }));
    }
  }, [loadingData, datasetData]);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await apiGet<{ id: number; name: string; config: string | object }>(`/api/dashboards/${id}`);
        if (res.success && res.data) {
          setDashboardData(res.data);
          const config = typeof res.data.config === 'string' ? JSON.parse(res.data.config) : res.data.config;
          if (config.widgets) {
            setWidgets(config.widgets);
            // Fetch data for all datasets used by widgets
            const datasetIds = new Set<number>();
            config.widgets.forEach((w: Widget) => {
              if (w.datasetId) datasetIds.add(w.datasetId);
            });
            datasetIds.forEach((datasetId) => fetchDatasetData(datasetId));
          }
        }
      } catch (e) {
        console.error('Failed to fetch dashboard:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [id, fetchDatasetData]);

  const getWidgetData = (widget: Widget): unknown[] => {
    if (widget.datasetId && datasetData[widget.datasetId]) {
      return datasetData[widget.datasetId];
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Dashboard not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/viewer/dashboard')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dashboardData.name || 'Dashboard'}</h1>
            <p className="text-gray-600">Real-time metrics and KPIs</p>
          </div>
        </div>
        <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </button>
      </div>

      {/* Global Controls */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search across all data..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Date Range Slicer */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
            >
              <option value="last-7-days">Last 7 Days</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="last-90-days">Last 90 Days</option>
              <option value="this-year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Region Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
            >
              <option value="all">All Regions</option>
              <option value="north-america">North America</option>
              <option value="europe">Europe</option>
              <option value="asia-pacific">Asia Pacific</option>
              <option value="latin-america">Latin America</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Widgets */}
      {widgets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No widgets configured for this dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map((widget) => {
            const widgetData = getWidgetData(widget);
            const isLoading = widget.datasetId ? loadingData[widget.datasetId] : false;
            
            return (
              <div
                key={widget.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                style={{
                  width: `${widget.size.width}px`,
                  height: `${widget.size.height}px`,
                  minHeight: '300px',
                }}
              >
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-medium text-gray-900 text-sm">{widget.title}</h3>
                </div>
                <div className="p-4" style={{ height: 'calc(100% - 48px)' }}>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  ) : (
                    renderWidget(widget, widgetData)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}