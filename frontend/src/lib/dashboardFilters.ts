/**
 * PowerBI-style report-level filters for the viewer dashboard.
 * - Search: any cell (string or number) contains the term (case-insensitive).
 * - Date: filter by date range using a discovered date column.
 * - Region: filter by a discovered region/country column; options from data.
 */

const DATE_COL_CANDIDATES = [
  'date', 'created_at', 'order_date', 'timestamp', 'time', 'created', 'updated_at',
  'start_date', 'end_date', '_date', 'sale_date', 'transaction_date', 'period'
];
const REGION_COL_CANDIDATES = [
  'region', 'region_name', 'country', 'country_name', 'area', 'geographic',
  'location', 'territory', 'zone', 'market', 'geo'
];

function parseDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    if (v > 1e12) return new Date(v); // ms
    if (v > 1e9) return new Date(v * 1000); // sec
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function looksLikeDateColumn(rows: any[], key: string): boolean {
  const sample = rows.slice(0, Math.min(50, rows.length)).map((r) => r?.[key]);
  let ok = 0;
  for (const v of sample) {
    if (v == null || v === '') continue;
    if (parseDate(v)) ok++;
  }
  return ok >= Math.max(1, sample.length * 0.3);
}

export function inferDateColumn(rows: any[]): string | undefined {
  if (!rows || rows.length === 0) return undefined;
  const keys = Object.keys(rows[0] || {});
  for (const k of keys) {
    const lower = k.toLowerCase();
    if (DATE_COL_CANDIDATES.some((c) => lower.includes(c) || lower === c)) {
      if (looksLikeDateColumn(rows, k)) return k;
    }
  }
  for (const k of keys) {
    if (looksLikeDateColumn(rows, k)) return k;
  }
  return undefined;
}

export function inferRegionColumn(rows: any[]): string | undefined {
  if (!rows || rows.length === 0) return undefined;
  const keys = Object.keys(rows[0] || {});
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const cand of REGION_COL_CANDIDATES) {
    const idx = lowerKeys.findIndex((lk) => lk === cand || lk.includes(cand));
    if (idx >= 0) return keys[idx];
  }
  return undefined;
}

function inDateRange(d: Date, range: string): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (range) {
    case 'last-7-days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return dDay >= from && dDay <= today;
    }
    case 'last-30-days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return dDay >= from && dDay <= today;
    }
    case 'last-90-days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 90);
      return dDay >= from && dDay <= today;
    }
    case 'this-year':
      return d.getFullYear() === today.getFullYear();
    case 'custom':
      // No date picker; treat as no filter
      return true;
    default:
      return true;
  }
}

export function applyGlobalFilters(
  rows: any[],
  filters: { search?: string; dateRange?: string; region?: string }
): any[] {
  if (!rows || rows.length === 0) return rows;
  let out = rows;

  // Search: any cell contains the term (case-insensitive)
  const search = (filters.search || '').trim();
  if (search) {
    const low = search.toLowerCase();
    out = out.filter((r) =>
      Object.values(r || {}).some((v) => String(v ?? '').toLowerCase().includes(low))
    );
  }

  // Date: filter by discovered date column
  const dateRange = filters.dateRange;
  if (dateRange && dateRange !== 'custom') {
    const dateCol = inferDateColumn(out);
    if (dateCol) {
      out = out.filter((r) => {
        const d = parseDate(r?.[dateCol]);
        return d != null && inDateRange(d, dateRange);
      });
    }
  }

  // Region: filter by discovered region column; "all" = no filter
  const region = filters.region;
  if (region && region !== 'all') {
    const regionCol = inferRegionColumn(out);
    if (regionCol) {
      const rLow = region.toLowerCase();
      out = out.filter((r) => {
        const v = String(r?.[regionCol] ?? '').toLowerCase();
        return v === rLow || v.includes(rLow);
      });
    }
  }

  return out;
}

/**
 * Collect unique region values from rows (from all datasets) for the Region dropdown.
 * Uses the first discovered region column across the combined rows.
 */
export function getRegionOptionsFromData(allRows: any[]): { value: string; label: string }[] {
  const base = [{ value: 'all', label: 'All Regions' }];
  if (!allRows || allRows.length === 0) return base;
  const regionCol = inferRegionColumn(allRows);
  if (!regionCol) return base;
  const set = new Set<string>();
  for (const r of allRows) {
    const v = String(r?.[regionCol] ?? '').trim();
    if (v) set.add(v);
  }
  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
  return base.concat(sorted.map((v) => ({ value: v, label: v })));
}
