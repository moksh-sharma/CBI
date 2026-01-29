/**
 * Widget renderer — thin wrapper around ChartRenderer.
 * Uses centralized chart registry. No chart-specific logic here.
 */

import { ChartRenderer, type ChartWidgetConfig } from '../charts/ChartRenderer';

export interface Widget {
  id: string;
  type: string;
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
  datasetId?: number;
  accentColor?: string;
}

export type RenderWidgetOptions = { mode?: 'light' | 'dark' };

/** For card/KPI value from raw data. Used by builder and elsewhere. */
export function getCardValue(widget: Widget, data: unknown[]): string {
  const aggregation = widget.aggregation || 'count';
  if (!widget.field || data.length === 0) return '0';
  switch (aggregation) {
    case 'count':
      return data.length.toString();
    case 'sum':
      return (data as any[]).reduce((acc, item) => acc + (Number(item[widget.field!]) || 0), 0).toLocaleString();
    case 'first':
      return String((data[0] as any)?.[widget.field!] ?? '0');
    case 'last':
      return String((data[data.length - 1] as any)?.[widget.field!] ?? '0');
    case 'percentage': {
      const total = (data as any[]).reduce((acc, item) => acc + (Number(item[widget.field!]) || 0), 0);
      return `${((total / data.length) * 100).toFixed(1)}%`;
    }
    default:
      return '0';
  }
}

export function renderWidget(
  widget: Widget,
  widgetData: unknown[],
  options?: RenderWidgetOptions
) {
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
  return ChartRenderer(config, widgetData, options);
}
