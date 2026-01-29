import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, Search, Filter, Calendar, Loader2, ChevronDown, Image, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { apiGet } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeColors } from '../../lib/themeColors';
import { applyGlobalFilters, getRegionOptionsFromData } from '../../lib/dashboardFilters';
import { renderWidget, Widget } from '../shared/WidgetRenderer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

export default function InteractiveDashboard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const [globalSearch, setGlobalSearch] = useState('');
  const [dateRange, setDateRange] = useState('last-30-days');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [datasetData, setDatasetData] = useState<Record<number, unknown[]>>({});
  const [loadingData, setLoadingData] = useState<Record<number, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const getWidgetData = useCallback(
    (widget: Widget): unknown[] => {
      const raw = widget.datasetId && datasetData[widget.datasetId]
        ? (datasetData[widget.datasetId] as any[])
        : [];
      return applyGlobalFilters(raw, {
        search: globalSearch,
        dateRange,
        region: selectedRegion,
      });
    },
    [datasetData, globalSearch, dateRange, selectedRegion]
  );

  // PowerBI-style: Region options from actual data (discovered region/country column)
  const regionOptions = useMemo(() => {
    const allRows = (Object.values(datasetData) as any[][]).flat();
    return getRegionOptionsFromData(allRows);
  }, [datasetData]);

  // Keep selectedRegion valid when options change (e.g. after data load)
  useEffect(() => {
    if (selectedRegion !== 'all' && !regionOptions.some((o) => o.value === selectedRegion)) {
      setSelectedRegion('all');
    }
  }, [regionOptions, selectedRegion]);

  const handleExportPng = useCallback(async () => {
    if (!canvasRef.current || !dashboardData) return;
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const el = canvasRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(dashboardData.name || 'dashboard').replace(/\s+/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    } catch (err) {
      console.error('Export PNG failed:', err);
    } finally {
      setExporting(false);
    }
  }, [dashboardData, isDark]);

  const handleExportPdf = useCallback(async () => {
    if (!canvasRef.current || !dashboardData) return;
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      const el = canvasRef.current;
      if (!el) return;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        logging: false,
      });
      const img = canvas.toDataURL('image/png');
      const isLandscape = canvas.width > canvas.height;
      const pdf = new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'pt', format: 'a4' });
      const a4W = isLandscape ? 842 : 595;
      const a4H = isLandscape ? 595 : 842;
      const fit = Math.min(a4W / canvas.width, a4H / canvas.height);
      pdf.addImage(img, 'PNG', 0, 0, canvas.width * fit, canvas.height * fit);
      pdf.save(`${(dashboardData.name || 'dashboard').replace(/\s+/g, '-')}.pdf`);
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setExporting(false);
    }
  }, [dashboardData, isDark]);

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

  const canvasMinHeight = widgets.length
    ? Math.max(...widgets.map((w) => w.position.y + w.size.height), 0) + 24
    : 320;
  const mode = isDark ? 'dark' : 'light';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/viewer/dashboard')}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.muted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = colors.text; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = colors.muted; e.currentTarget.style.background = 'transparent'; }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text }}>{dashboardData.name || 'Dashboard'}</h1>
            <p style={{ color: colors.muted }}>Real-time metrics and KPIs</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={widgets.length === 0 || exporting}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[180px] border"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.cardBorder,
              color: colors.text,
            }}
          >
            <DropdownMenuItem
              onSelect={() => handleExportPng()}
              disabled={widgets.length === 0}
              style={{ color: colors.text }}
              className={isDark ? 'data-[highlighted]:bg-white/10' : 'data-[highlighted]:bg-green-50'}
            >
              <Image className="w-4 h-4 mr-2" />
              Download as PNG
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleExportPdf()}
              disabled={widgets.length === 0}
              style={{ color: colors.text }}
              className={isDark ? 'data-[highlighted]:bg-white/10' : 'data-[highlighted]:bg-green-50'}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Download as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global Controls */}
      <div
        className="rounded-xl p-6 shadow-sm border"
        style={{
          backgroundColor: colors.cardBg,
          borderColor: colors.cardBorder,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.muted }} />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search across all data..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none placeholder:opacity-60"
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              }}
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.muted }} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              }}
            >
              <option value="last-7-days" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Last 7 Days</option>
              <option value="last-30-days" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Last 30 Days</option>
              <option value="last-90-days" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Last 90 Days</option>
              <option value="this-year" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>This Year</option>
              <option value="custom" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>Custom Range</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.muted }} />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              }}
            >
              {regionOptions.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f1f5f9' : '#1e293b' }}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Canvas: absolute layout to match builder, no overlap, overflow contained */}
      {widgets.length === 0 ? (
        <div className="text-center py-12" style={{ color: colors.muted }}>
          <p>No widgets configured for this dashboard.</p>
        </div>
      ) : (
        <div
          ref={canvasRef}
          className="relative w-full p-6"
          style={{ minHeight: canvasMinHeight }}
        >
          {widgets.map((widget) => {
            const widgetData = getWidgetData(widget);
            const isLoading = widget.datasetId ? loadingData[widget.datasetId] : false;

            return (
              <div
                key={widget.id}
                className="rounded-lg shadow-sm overflow-hidden"
                style={{
                  position: 'absolute',
                  left: widget.position.x,
                  top: widget.position.y,
                  width: widget.size.width,
                  height: widget.size.height,
                  minHeight: 160,
                  backgroundColor: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                }}
              >
                <div
                  className="px-4 py-3 border-b"
                  style={{
                    borderColor: colors.cardBorder,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
                  }}
                >
                  <h3 className="font-medium text-sm truncate" style={{ color: colors.text }} title={widget.title}>{widget.title}</h3>
                </div>
                <div
                  className="p-4 overflow-hidden"
                  style={{
                    height: 'calc(100% - 48px)',
                    minHeight: 0,
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                  ) : (
                    renderWidget(widget, widgetData, { mode })
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