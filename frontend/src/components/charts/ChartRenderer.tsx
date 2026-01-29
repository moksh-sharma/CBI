/**
 * Unified ChartRenderer — Power BI–like standard chart system.
 * Accepts chartType + config + dataset; dynamically renders the correct chart from registry.
 * All charts support resize (parent), theme/colors, and dynamic data binding.
 */

import React from 'react';
import { buildAggregatedSeries, getPieDonutData } from '../../lib/widgetDataUtils';
import { getChartMeta } from '../../lib/chartRegistry';
import {
  PowerBIArea,
  PowerBIBar,
  PowerBIBubble,
  PowerBICombo,
  PowerBIFunnel,
  PowerBILine,
  PowerBIPie,
  PowerBIScatter,
  PowerBIStackedBar,
  PowerBITreemap,
  PowerBIWaterfall
} from '../shared/powerbiCharts';

/** Widget-like config. Supports all registry chart types + legacy 'filter'. */
export interface ChartWidgetConfig {
  id: string;
  type: string;
  title?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  aggregation?: 'count' | 'sum' | 'first' | 'last' | 'percentage';
  field?: string;
  xAxis?: string;
  yAxis?: string;
  legend?: string;
  filterField?: string;
  selectedFilters?: string[];
  datasetId?: number;
  accentColor?: string;
}

export type ChartRendererOptions = {
  mode?: 'light' | 'dark';
  /** When rendering a Slicer, call this on option click. Builder uses it to update selectedFilters + globalFilters. */
  onSlicerChange?: (value: string, selected: boolean) => void;
};

function getCardValue(config: ChartWidgetConfig, data: unknown[]): string {
  const aggregation = config.aggregation || 'count';
  if (!config.field || data.length === 0) return '0';
  switch (aggregation) {
    case 'count':
      return data.length.toString();
    case 'sum':
      return (data as any[]).reduce((acc, item) => acc + (Number(item[config.field!]) || 0), 0).toLocaleString();
    case 'first':
      return String((data[0] as any)?.[config.field!] ?? '0');
    case 'last':
      return String((data[data.length - 1] as any)?.[config.field!] ?? '0');
    case 'percentage': {
      const total = (data as any[]).reduce((acc, item) => acc + (Number(item[config.field!]) || 0), 0);
      return `${((total / data.length) * 100).toFixed(1)}%`;
    }
    default:
      return '0';
  }
}

function PlaceholderChart({ label, mode }: { label: string; mode: 'light' | 'dark' }) {
  const isDark = mode === 'dark';
  return (
    <div className="flex flex-col items-center justify-center h-full text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
      <p className="font-medium mb-1">{label}</p>
      <p className="text-xs opacity-75">Coming soon</p>
    </div>
  );
}

/** Decomposition Tree: rule-based drilldown placeholder. Supports dynamic dimension expansion. */
function DecompositionTreePlaceholder({ config, mode }: { config: ChartWidgetConfig; mode: 'light' | 'dark' }) {
  const isDark = mode === 'dark';
  const cat = config.xAxis || config.legend || 'Category';
  const val = config.yAxis || config.field || 'Value';
  return (
    <div className="h-full flex flex-col p-4 text-sm" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>
      <p className="font-medium mb-2 opacity-90">Decomposition Tree</p>
      <p className="text-xs mb-3" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
        Rule-based drilldown • Drag <strong>{cat}</strong> and <strong>{val}</strong> in Fields
      </p>
      <div className="flex-1 rounded-lg border flex items-center justify-center" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
        <p className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Configure category + value, then use drill-down</p>
      </div>
    </div>
  );
}

/** Key Influencers: ML-ready placeholder. Renders a ranked influencer list. */
function KeyInfluencersPlaceholder({ mode }: { mode: 'light' | 'dark' }) {
  const isDark = mode === 'dark';
  const mock = [
    { rank: 1, factor: 'Region', impact: '+12.4%' },
    { rank: 2, factor: 'Product', impact: '+8.1%' },
    { rank: 3, factor: 'Segment', impact: '-3.2%' },
  ];
  return (
    <div className="h-full flex flex-col p-4 text-sm" style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>
      <p className="font-medium mb-2 opacity-90">Key Influencers</p>
      <p className="text-xs mb-3" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
        ML-ready • Backend placeholder
      </p>
      <div className="space-y-2">
        {mock.map(({ rank, factor, impact }) => (
          <div
            key={rank}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
          >
            <span className="font-medium">{rank}. {factor}</span>
            <span style={{ color: impact.startsWith('+') ? '#22c55e' : '#ef4444' }}>{impact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartRenderer(
  config: ChartWidgetConfig,
  rawData: unknown[],
  options?: ChartRendererOptions
): React.ReactElement {
  const mode = options?.mode ?? 'light';
  const isDark = mode === 'dark';
  const onSlicerChange = options?.onSlicerChange;
  const widgetLike = {
    xAxis: config.xAxis,
    yAxis: config.yAxis,
    legend: config.legend,
    field: config.field,
    aggregation: config.aggregation,
  };

  const emptyMessage = (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
      {config.datasetId ? 'No data available' : 'Select a data source and assign columns'}
    </div>
  );

  if (rawData.length === 0) return emptyMessage;

  const chartType = config.type === 'filter' ? 'slicer' : config.type;
  const meta = getChartMeta(chartType);

  switch (chartType) {
    case 'bar':
    case 'column':
    case 'stacked-bar': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;

      const isHorizontal = chartType === 'bar' || chartType === 'stacked-bar';
      const layout = isHorizontal ? 'vertical' : 'horizontal';

      const isStacked = chartType === 'stacked-bar' || !!config.legend;

      if (isStacked) {
        const firstRow = series[0] as any;
        const xKeyVal = config.xAxis || '';
        const keys = Object.keys(firstRow || {}).filter((k) => k !== xKeyVal && k !== 'undefined');

        if (keys.length > 0) {
          return (
            <PowerBIStackedBar
              data={series}
              xKey={config.xAxis}
              stackKeys={keys}
              mode={mode}
              layout={layout}
            />
          );
        }
      }

      return (
        <PowerBIBar
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          mode={mode}
          id={config.id}
          layout={layout}
        />
      );
    }
    case 'line': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBILine
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          mode={mode}
        />
      );
    }
    case 'area': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBIArea
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          mode={mode}
          id={config.id}
        />
      );
    }
    case 'pie': {
      const data = getPieDonutData(rawData, widgetLike);
      if (data.length === 0) return emptyMessage;
      return <PowerBIPie data={data} nameKey="name" valueKey="value" mode={mode} />;
    }
    case 'donut': {
      const data = getPieDonutData(rawData, widgetLike);
      if (data.length === 0) return emptyMessage;
      return <PowerBIPie data={data} nameKey="name" valueKey="value" mode={mode} donut />;
    }
    case 'treemap': {
      const aggregated = buildAggregatedSeries(rawData, widgetLike);
      const xKey = config.xAxis || config.legend;
      const yKey = config.yAxis || config.field;
      const treemapData = xKey && yKey
        ? (aggregated as any[]).map((row, idx) => ({
          name: String(row?.[xKey] ?? `Item ${idx + 1}`),
          value: Number(row?.[yKey]) || 0,
        }))
        : [];
      if (treemapData.length === 0) return emptyMessage;
      return <PowerBITreemap data={treemapData} mode={mode} />;
    }
    case 'gauge': {
      let gaugeValue = 0;
      if (rawData.length > 0 && config.field) {
        const v = Number((rawData[0] as any)[config.field]) || 0;
        gaugeValue = config.aggregation === 'percentage' ? v : Math.min(100, (v / 100) * 100);
      }
      const trackStroke = isDark ? '#1f2937' : '#e5e7eb';
      const gaugeText = isDark ? '#e2e8f0' : '#111827';
      const gaugeMuted = isDark ? '#94a3b8' : '#6b7280';
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke={trackStroke} strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="10"
                strokeDasharray={`${gaugeValue * 2.827}, 283`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 700ms ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: gaugeText }}>{Math.round(gaugeValue)}%</span>
            </div>
          </div>
          <p className="mt-4 text-sm" style={{ color: gaugeMuted }}>{config.field || 'Value'}</p>
        </div>
      );
    }
    case 'card':
    case 'kpi': {
      const cardValue = getCardValue(config, rawData);
      const cardText = isDark ? '#f1f5f9' : '#111827';
      const cardMuted = isDark ? '#94a3b8' : '#6b7280';
      return (
        <div
          className="flex flex-col items-center justify-center h-full rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          }}
        >
          <div className="w-full h-1" style={{ backgroundColor: config.accentColor || '#118DFF' }} />
          <div className="flex-1 w-full flex flex-col items-center justify-center px-3">
            <p className="text-xs mb-2" style={{ color: cardMuted }}>{config.field || 'Value'}</p>
            <p className="text-5xl font-bold" style={{ color: cardText }}>{cardValue}</p>
            <p
              className="text-xs mt-3 capitalize px-3 py-1 rounded-full border"
              style={{ color: cardMuted, borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb' }}
            >
              {config.aggregation || 'count'}
            </p>
          </div>
        </div>
      );
    }
    case 'table':
    case 'matrix': {
      const firstRow = rawData[0] as any;
      const cols = Object.keys(firstRow || {});
      const thBg = isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb';
      const thColor = isDark ? '#94a3b8' : '#4b5563';
      const tdColor = isDark ? '#e2e8f0' : '#111827';
      const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb';
      return (
        <div className="h-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr>
                {cols.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs" style={{ backgroundColor: thBg, color: thColor }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rawData as any[]).map((row, idx) => (
                <tr
                  key={idx}
                  className={isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
                  style={{ borderTop: idx === 0 ? 'none' : `1px solid ${borderColor}` }}
                >
                  {cols.map((col) => (
                    <td key={col} className="px-3 py-2 text-xs" style={{ color: tdColor }}>{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'slicer': {
      const filterField = config.filterField ?? (config as any).filterField;
      const uniqueValues = filterField ? Array.from(new Set((rawData as any[]).map((d) => d[filterField]))) : [];
      const filterHeaderColor = isDark ? '#94a3b8' : '#374151';
      const filterBtnBase = isDark
        ? { background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)' }
        : { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' };
      const filterBtnSelected = isDark
        ? { background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }
        : { background: '#eef2ff', color: '#4338ca', border: '1px solid #a5b4fc' };
      const selectedFilters = config.selectedFilters ?? [];
      return (
        <div className="h-full flex flex-col min-h-0">
          <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }}>
            <p className="text-xs font-medium truncate" style={{ color: filterHeaderColor }}>{filterField || 'Select field'}</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3">
            {uniqueValues.length > 0 ? (
              <div className="space-y-2">
                {uniqueValues.map((value, index) => {
                  const isSelected = selectedFilters.includes(String(value));
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onSlicerChange?.(String(value), !isSelected)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate"
                      style={isSelected ? filterBtnSelected : filterBtnBase}
                    >
                      {String(value)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-sm py-4" style={{ color: isDark ? '#64748b' : '#6b7280' }}>No filter values available</div>
            )}
          </div>
        </div>
      );
    }
    case 'scatter': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBIScatter
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          mode={mode}
        />
      );
    }
    case 'bubble': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBIBubble
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          zKey={config.legend}
          mode={mode}
        />
      );
    }
    case 'waterfall': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBIWaterfall
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          mode={mode}
        />
      );
    }
    case 'funnel': {
      const data = getPieDonutData(rawData, widgetLike);
      if (data.length === 0) return emptyMessage;
      return (
        <PowerBIFunnel
          data={data}
          nameKey="name"
          valueKey="value"
          mode={mode}
        />
      );
    }
    case 'combo': {
      const series = buildAggregatedSeries(rawData, widgetLike);
      if (series.length === 0) return emptyMessage;
      return (
        <PowerBICombo
          data={series}
          xKey={config.xAxis}
          yKey={config.yAxis || config.field}
          lineKey={config.legend}
          mode={mode}
          id={config.id}
        />
      );
    }
    case 'maps':
      return <PlaceholderChart label="Maps" mode={mode} />;
    case 'decomposition-tree':
      return <DecompositionTreePlaceholder config={config} mode={mode} />;
    case 'key-influencers':
      return <KeyInfluencersPlaceholder mode={mode} />;
    default:
      if (meta) return <PlaceholderChart label={meta.label} mode={mode} />;
      return (
        <div className="flex items-center justify-center h-full text-sm" style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
          Unknown chart type
        </div>
      );
  }
}
