/**
 * Shared utilities for widget data: aggregation and chart-specific transforms.
 * Used by DashboardBuilder (preview) and WidgetRenderer (viewer) so charts look identical.
 */

export type Aggregation = 'count' | 'sum' | 'first' | 'last' | 'percentage';

export interface WidgetLike {
  xAxis?: string;
  yAxis?: string;
  legend?: string;
  field?: string;
  aggregation?: Aggregation;
}

export function inferIsNumericField(rows: unknown[], field?: string): boolean {
  if (!field) return false;
  const sample = (rows as any[]).slice(0, 50);
  for (const r of sample) {
    const v = r?.[field];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number') return true;
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return true;
    return false;
  }
  return false;
}

export function aggregate(values: number[], agg?: Aggregation): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case 'count':
      return values.length;
    case 'first':
      return values[0] ?? 0;
    case 'last':
      return values[values.length - 1] ?? 0;
    case 'percentage': {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return avg;
    }
    case 'sum':
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * PowerBI-like grouping:
 * - If X-axis is set, group by X-axis and aggregate Values.
 * - If Legend is set, group by (X-axis, Legend) and spread to multiple series keys.
 */
export function buildAggregatedSeries(rows: unknown[], widget: WidgetLike): unknown[] {
  const xKey = widget.xAxis;
  const yKey = widget.yAxis || widget.field;
  const legendKey = widget.legend;

  if (!xKey || !yKey) return rows;
  const agg = widget.aggregation || 'sum';

  const numeric = inferIsNumericField(rows, yKey);
  const effectiveAgg: Aggregation = numeric ? agg : 'count';

  const map = new Map<string, any>();

  for (const r of rows as any[]) {
    const x = r?.[xKey];
    const xLabel = String(x ?? '');

    if (legendKey) {
      const l = r?.[legendKey];
      const lLabel = String(l ?? '');
      const k = `${xLabel}||${lLabel}`;
      const v = numeric ? Number(r?.[yKey]) || 0 : 1;
      const existing = map.get(k) || { __x: xLabel, __legend: lLabel, __vals: [] as number[] };
      existing.__vals.push(v);
      map.set(k, existing);
    } else {
      const k = xLabel;
      const v = numeric ? Number(r?.[yKey]) || 0 : 1;
      const existing = map.get(k) || { [xKey]: xLabel, __vals: [] as number[] };
      existing.__vals.push(v);
      map.set(k, existing);
    }
  }

  if (!legendKey) {
    const out: any[] = [];
    for (const entry of map.values()) {
      out.push({
        [xKey]: entry[xKey],
        [yKey]: aggregate(entry.__vals, effectiveAgg),
      });
    }
    return out;
  }

  const legendValues = new Set<string>();
  for (const entry of map.values()) legendValues.add(entry.__legend);

  const byX = new Map<string, any>();
  for (const entry of map.values()) {
    const x = entry.__x;
    const l = entry.__legend;
    const val = aggregate(entry.__vals, effectiveAgg);
    const row = byX.get(x) || { [xKey]: x };
    row[l] = val;
    byX.set(x, row);
  }

  return Array.from(byX.values()).map((row) => {
    for (const l of legendValues) {
      if (row[l] === undefined) row[l] = 0;
    }
    return row;
  });
}

export interface PieDonutItem {
  name: string;
  value: number;
}

/**
 * Pie/donut: nameKey = legend || xAxis, valueKey = yAxis || field; sum by name.
 */
export function getPieDonutData(rows: unknown[], widget: WidgetLike): PieDonutItem[] {
  const nameKey = widget.legend || widget.xAxis;
  const valueKey = widget.yAxis || widget.field;
  if (!nameKey || !valueKey) return [];

  return (rows as any[]).reduce((acc: PieDonutItem[], row) => {
    const name = String(row?.[nameKey] ?? '');
    const v = Number(row?.[valueKey]);
    const value = Number.isFinite(v) ? v : 1;
    const found = acc.find((x) => x.name === name);
    if (found) found.value += value;
    else acc.push({ name, value });
    return acc;
  }, []);
}
