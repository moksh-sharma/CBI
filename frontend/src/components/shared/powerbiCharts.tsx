import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

const PBI_COLORS = [
  '#118DFF', // Power BI-ish blue
  '#12239E',
  '#E66C37',
  '#6B007B',
  '#00B7C3',
  '#744EC2',
  '#D64550',
  '#7FBA00',
  '#FFB900',
  '#4C78A8',
];

type ThemeMode = 'light' | 'dark';

function getChartTokens(mode: ThemeMode) {
  const isDark = mode === 'dark';
  return {
    // PowerBI uses subtle gridlines and neutral typography.
    grid: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(107, 114, 128, 0.20)',
    axis: isDark ? 'rgba(226, 232, 240, 0.72)' : 'rgba(55, 65, 81, 0.78)',
    tick: isDark ? 'rgba(226, 232, 240, 0.78)' : 'rgba(55, 65, 81, 0.86)',
    legend: isDark ? 'rgba(226, 232, 240, 0.82)' : 'rgba(17, 24, 39, 0.80)',
    tooltipBg: isDark ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: isDark ? 'rgba(55, 65, 81, 1)' : 'rgba(229, 231, 235, 1)',
    tooltipText: isDark ? '#f9fafb' : '#111827',
    fontSize: 11,
  };
}

export function PowerBITooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: any[];
  label?: unknown;
  mode: ThemeMode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const t = getChartTokens(mode);
  return (
    <div
      className="rounded-md border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        color: t.tooltipText,
        backdropFilter: 'blur(10px)',
      }}
    >
      {label !== undefined && label !== null && (
        <div className="text-[11px] font-medium mb-1" style={{ opacity: 0.9 }}>
          {String(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-6 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color || PBI_COLORS[0] }} />
              <span className="truncate" style={{ opacity: 0.9 }}>
                {String(p.name ?? '')}
              </span>
            </div>
            <span className="font-semibold">
              {typeof p.value === 'number' ? p.value.toLocaleString() : String(p.value ?? '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function commonAxisProps(mode: ThemeMode) {
  const t = getChartTokens(mode);
  return {
    stroke: t.axis,
    tick: { fill: t.tick, fontSize: t.fontSize },
    axisLine: true,
    tickLine: false,
    minTickGap: 10,
  } as const;
}

function commonGridProps(mode: ThemeMode) {
  const t = getChartTokens(mode);
  return {
    stroke: t.grid,
    strokeDasharray: '2 4',
    vertical: false,
  } as const;
}

function commonLegendProps(mode: ThemeMode) {
  const t = getChartTokens(mode);
  return {
    verticalAlign: 'top' as const,
    align: 'left' as const,
    iconType: 'circle' as const,
    iconSize: 8,
    wrapperStyle: { fontSize: t.fontSize, color: t.legend, paddingBottom: 6 },
  };
}

export function PowerBIBar({
  data,
  xKey,
  yKey,
  mode,
  id,
  layout = 'horizontal',
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  mode: ThemeMode;
  id: string;
  layout?: 'horizontal' | 'vertical';
}) {
  const t = getChartTokens(mode);
  const barColor = PBI_COLORS[0];
  const barColor2 = mode === 'dark' ? '#0b5cab' : '#0b6bd6';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data as any[]}
        layout={layout}
        margin={{ top: 12, right: 10, bottom: 4, left: 8 }}
      >
        <defs>
          <linearGradient id={`pbi-bar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor={barColor2} stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid {...commonGridProps(mode)} horizontal={layout === 'horizontal'} vertical={layout === 'vertical'} />
        {layout === 'horizontal' ? (
          <>
            <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
            <YAxis {...commonAxisProps(mode)} />
          </>
        ) : (
          <>
            <XAxis type="number" {...commonAxisProps(mode)} />
            <YAxis dataKey={xKey} type="category" {...commonAxisProps(mode)} width={100} />
          </>
        )}
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Bar
          dataKey={yKey}
          fill={`url(#pbi-bar-${id})`}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PowerBIStackedBar({
  data,
  xKey,
  stackKeys,
  mode,
  layout = 'horizontal',
}: {
  data: unknown[];
  xKey?: string;
  stackKeys: string[];
  mode: ThemeMode;
  layout?: 'horizontal' | 'vertical';
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data as any[]}
        layout={layout}
        margin={{ top: 12, right: 10, bottom: 4, left: 8 }}
      >
        <CartesianGrid {...commonGridProps(mode)} horizontal={layout === 'horizontal'} vertical={layout === 'vertical'} />
        {layout === 'horizontal' ? (
          <>
            <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
            <YAxis type="number" {...commonAxisProps(mode)} />
          </>
        ) : (
          <>
            <XAxis type="number" {...commonAxisProps(mode)} />
            <YAxis dataKey={xKey} type="category" {...commonAxisProps(mode)} width={100} />
          </>
        )}
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        {stackKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="a"
            fill={PBI_COLORS[index % PBI_COLORS.length]}
            isAnimationActive
            animationDuration={800}
            animationEasing="ease-out"
            radius={index === stackKeys.length - 1 ? (layout === 'horizontal' ? [4, 4, 0, 0] : [0, 4, 4, 0]) : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PowerBILine({
  data,
  xKey,
  yKey,
  mode,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  mode: ThemeMode;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data as any[]} margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis {...commonAxisProps(mode)} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={PBI_COLORS[0]}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
          strokeLinecap="round"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PowerBIArea({
  data,
  xKey,
  yKey,
  mode,
  id,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  mode: ThemeMode;
  id: string;
}) {
  const fillTop = PBI_COLORS[0];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data as any[]} margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id={`pbi-area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTop} stopOpacity={0.40} />
            <stop offset="100%" stopColor={fillTop} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis {...commonAxisProps(mode)} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={PBI_COLORS[0]}
          strokeWidth={2.25}
          fill={`url(#pbi-area-${id})`}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PowerBIPie({
  data,
  nameKey,
  valueKey,
  mode,
  donut,
}: {
  data: { name: string; value: number }[];
  nameKey: string;
  valueKey: string;
  mode: ThemeMode;
  donut?: boolean;
}) {
  // PowerBI typically avoids outside labels by default; relies on tooltip + legend.
  // Use percentage radii so the visual scales smoothly when the widget is resized.
  const innerRadius = donut ? '55%' : 0;
  const outerRadius = donut ? '82%' : '86%';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 10, right: 10, bottom: 8, left: 10 }}>
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={valueKey}
          cx="50%"
          cy="52%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          cornerRadius={8}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={PBI_COLORS[index % PBI_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PowerBITreemap({
  data,
  mode,
}: {
  data: { name: string; value: number }[];
  mode: ThemeMode;
}) {
  // Recharts treemap is limited; this gives a cleaner PowerBI-like look.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={data}
        dataKey="value"
        stroke={mode === 'dark' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255,255,255,0.9)'}
        fill={PBI_COLORS[0]}
        isAnimationActive
        animationDuration={800}
      >
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
      </Treemap>
    </ResponsiveContainer>
  );
}

export function PowerBIScatter({
  data,
  xKey,
  yKey,
  mode,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  mode: ThemeMode;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis dataKey={yKey} {...commonAxisProps(mode)} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Scatter
          data={data as any[]}
          fill={PBI_COLORS[0]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function PowerBIBubble({
  data,
  xKey,
  yKey,
  zKey,
  mode,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  zKey?: string;
  mode: ThemeMode;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis dataKey={yKey} {...commonAxisProps(mode)} />
        <ZAxis dataKey={zKey} range={[60, 400]} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Scatter
          data={data as any[]}
          fill={PBI_COLORS[0]}
          fillOpacity={0.7}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function PowerBIWaterfall({
  data,
  xKey,
  yKey,
  mode,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  mode: ThemeMode;
}) {
  // Transform data to waterfall format with cumulative values
  const waterfallData = (data as any[]).map((item, index) => {
    const value = Number(item[yKey || 'value']) || 0;
    const prevSum = index === 0 ? 0 : (data as any[])
      .slice(0, index)
      .reduce((sum, d) => sum + (Number(d[yKey || 'value']) || 0), 0);

    return {
      ...item,
      start: prevSum,
      end: prevSum + value,
      value: value,
      isPositive: value >= 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={waterfallData} margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis {...commonAxisProps(mode)} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Bar
          dataKey="value"
          radius={[6, 6, 2, 2]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        >
          {waterfallData.map((entry, index) => (
            <Cell key={index} fill={entry.isPositive ? '#22c55e' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PowerBIFunnel({
  data,
  nameKey,
  valueKey,
  mode,
}: {
  data: unknown[];
  nameKey?: string;
  valueKey?: string;
  mode: ThemeMode;
}) {
  const t = getChartTokens(mode);
  const isDark = mode === 'dark';

  // Sort data by value descending for funnel effect
  const sortedData = [...(data as any[])].sort((a, b) =>
    (Number(b[valueKey || 'value']) || 0) - (Number(a[valueKey || 'value']) || 0)
  );

  const maxValue = Math.max(...sortedData.map(d => Number(d[valueKey || 'value']) || 0));

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-1">
        {sortedData.map((item, index) => {
          const value = Number(item[valueKey || 'value']) || 0;
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const name = String(item[nameKey || 'name'] || `Stage ${index + 1}`);

          return (
            <div key={index} className="flex flex-col items-center">
              <div
                className="relative flex items-center justify-between px-4 py-3 rounded-md transition-all duration-300 hover:opacity-90"
                style={{
                  width: `${Math.max(percentage, 20)}%`,
                  backgroundColor: PBI_COLORS[index % PBI_COLORS.length],
                  color: '#ffffff',
                }}
              >
                <span className="text-xs font-medium truncate">{name}</span>
                <span className="text-xs font-bold ml-2">{value.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PowerBICombo({
  data,
  xKey,
  yKey,
  lineKey,
  mode,
  id,
}: {
  data: unknown[];
  xKey?: string;
  yKey?: string;
  lineKey?: string;
  mode: ThemeMode;
  id: string;
}) {
  const barColor = PBI_COLORS[0];
  const barColor2 = mode === 'dark' ? '#0b5cab' : '#0b6bd6';
  const lineColor = PBI_COLORS[2];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data as any[]} margin={{ top: 12, right: 10, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id={`pbi-combo-bar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor={barColor2} stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid {...commonGridProps(mode)} />
        <XAxis dataKey={xKey} {...commonAxisProps(mode)} />
        <YAxis {...commonAxisProps(mode)} />
        <Tooltip content={(p) => <PowerBITooltip {...(p as any)} mode={mode} />} />
        <Legend {...commonLegendProps(mode)} />
        <Bar
          dataKey={yKey}
          fill={`url(#pbi-combo-bar-${id})`}
          radius={[6, 6, 2, 2]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey={lineKey || yKey}
          stroke={lineColor}
          strokeWidth={2.5}
          dot={{ r: 4, fill: lineColor }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
          strokeLinecap="round"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

