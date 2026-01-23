import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Treemap } from 'recharts';

export interface Widget {
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
  datasetId?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const getCardValue = (widget: Widget, data: unknown[]): string => {
  const aggregation = widget.aggregation || 'count';
  
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
      const total = data.reduce((acc: number, item: any) => {
        const val = Number(item[widget.field!]) || 0;
        return acc + val;
      }, 0);
      return `${((total / data.length) * 100).toFixed(1)}%`;
    default:
      return '0';
  }
};

export const renderWidget = (widget: Widget, widgetData: unknown[]) => {
  // If no data, show message
  if (widgetData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        {widget.datasetId ? 'No data available' : 'Select a data source and assign columns'}
      </div>
    );
  }

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
            <Line type="monotone" dataKey={widget.yAxis} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
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
            <Area type="monotone" dataKey={widget.yAxis} stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      );
    case 'pie':
      const pieData = widget.xAxis && widget.yAxis
        ? widgetData.map((item: any) => ({
            name: String(item[widget.xAxis!] || ''),
            value: Number(item[widget.yAxis!]) || 0
          }))
        : [];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'donut':
      const donutData = widget.xAxis && widget.yAxis
        ? widgetData.map((item: any) => ({
            name: String(item[widget.xAxis!] || ''),
            value: Number(item[widget.yAxis!]) || 0
          }))
        : [];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              innerRadius={40}
              fill="#8884d8"
              dataKey="value"
            >
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'treemap':
      const treemapData = widget.xAxis && widget.yAxis
        ? widgetData.map((item: any) => ({
            name: String(item[widget.xAxis!] || ''),
            value: Number(item[widget.yAxis!]) || 0
          }))
        : [];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treemapData}
            dataKey="value"
            stroke="#fff"
            fill="#3b82f6"
          >
            <Tooltip />
          </Treemap>
        </ResponsiveContainer>
      );
    case 'gauge':
      const gaugeData = widgetData;
      let gaugeValue = 0;
      if (gaugeData.length > 0 && widget.field) {
        const firstItem = gaugeData[0] as any;
        const value = Number(firstItem[widget.field]) || 0;
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
                strokeDasharray={`${gaugeValue * 2.827} 282.7`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{gaugeValue.toFixed(0)}%</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">{widget.title}</p>
        </div>
      );
    case 'card':
      const cardValue = getCardValue(widget, widgetData);
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-4xl font-bold text-gray-900 mb-2">{cardValue}</div>
          <p className="text-sm text-gray-600">{widget.title}</p>
          {widget.field && (
            <p className="text-xs text-gray-500 mt-1">Field: {widget.field}</p>
          )}
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
      const firstRow = widgetData[0] as any;
      const tableColumns = Object.keys(firstRow || {});
      return (
        <div className="h-full overflow-auto">
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
      const filterData = widgetData;
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {String(value)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 text-sm py-4">
                No filter values available
              </div>
            )}
          </div>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Unknown widget type
        </div>
      );
  }
};
