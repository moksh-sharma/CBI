/**
 * Data Preview Component
 * Power BI-like data preview pane showing raw dataset data
 */

import { useState, useMemo } from 'react';
import { Table, Search, Download, RefreshCw, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';

interface DataPreviewProps {
    datasetId: number;
    datasetName: string;
    data: unknown[];
    columns: { name: string; type: string }[];
    onRefresh?: () => void;
    onClose?: () => void;
    isDark: boolean;
    colors: any;
}

export default function DataPreview({
    datasetId,
    datasetName,
    data,
    columns,
    onRefresh,
    onClose,
    isDark,
    colors
}: DataPreviewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    // Filter and search data
    const filteredData = useMemo(() => {
        let result = [...data];

        // Apply search
        if (searchTerm.trim()) {
            result = result.filter(row => {
                if (!row || typeof row !== 'object') return false;
                return Object.values(row).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }

        // Apply column filters
        Object.entries(columnFilters).forEach(([column, filterValue]) => {
            if (filterValue.trim()) {
                result = result.filter(row => {
                    const value = (row as any)[column];
                    return String(value).toLowerCase().includes(filterValue.toLowerCase());
                });
            }
        });

        // Apply sorting
        if (sortColumn) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortColumn];
                const bVal = (b as any)[sortColumn];

                if (aVal === bVal) return 0;

                const comparison = aVal < bVal ? -1 : 1;
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return result;
    }, [data, searchTerm, sortColumn, sortDirection, columnFilters]);

    // Pagination
    const totalPages = Math.ceil(filteredData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredData.length);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleExport = () => {
        // Convert to CSV
        const headers = columns.map(c => c.name).join(',');
        const rows = filteredData.map(row =>
            columns.map(col => {
                const value = (row as any)[col.name];
                // Escape commas and quotes
                const escaped = String(value).replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',')
        );

        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${datasetName}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getColumnStats = (columnName: string) => {
        const values = data.map(row => (row as any)[columnName]).filter(v => v != null);
        const uniqueCount = new Set(values).size;
        const nullCount = data.length - values.length;

        return {
            total: data.length,
            unique: uniqueCount,
            nulls: nullCount,
            filled: values.length
        };
    };

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: colors.cardBg }}>
            {/* Header */}
            <div className="px-4 py-3 border-b" style={{ borderColor: colors.cardBorder }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Table className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h3 style={{ color: colors.text }} className="font-semibold">{datasetName}</h3>
                            <p style={{ color: colors.muted }} className="text-xs">
                                {filteredData.length.toLocaleString()} rows × {columns.length} columns
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: colors.text }}
                                title="Refresh data"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            style={{ color: colors.text }}
                            title="Export to CSV"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: colors.text }}
                                title="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.muted }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search all columns..."
                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead
                        className="sticky top-0 z-10"
                        style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(249, 250, 251, 0.95)' }}
                    >
                        <tr>
                            <th
                                className="px-3 py-2 text-left font-medium border-b"
                                style={{ borderColor: colors.cardBorder, color: colors.muted }}
                            >
                                #
                            </th>
                            {columns.map(column => {
                                const stats = getColumnStats(column.name);
                                return (
                                    <th
                                        key={column.name}
                                        className="px-3 py-2 text-left border-b"
                                        style={{ borderColor: colors.cardBorder }}
                                    >
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => handleSort(column.name)}
                                                className="flex items-center gap-1 font-medium hover:text-indigo-600 transition-colors"
                                                style={{ color: sortColumn === column.name ? '#6366f1' : colors.text }}
                                            >
                                                {column.name}
                                                {sortColumn === column.name && (
                                                    <span className="text-xs">
                                                        {sortDirection === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-xs px-1.5 py-0.5 rounded"
                                                    style={{
                                                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                                        color: '#6366f1'
                                                    }}
                                                >
                                                    {column.type}
                                                </span>
                                                <span style={{ color: colors.muted }} className="text-xs" title={`${stats.unique} unique, ${stats.nulls} nulls`}>
                                                    {stats.filled}/{stats.total}
                                                </span>
                                            </div>
                                            <div className="relative">
                                                <Filter className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: colors.muted }} />
                                                <input
                                                    type="text"
                                                    value={columnFilters[column.name] || ''}
                                                    onChange={(e) => {
                                                        setColumnFilters(prev => ({
                                                            ...prev,
                                                            [column.name]: e.target.value
                                                        }));
                                                        setCurrentPage(1);
                                                    }}
                                                    placeholder="Filter..."
                                                    className="w-full pl-6 pr-2 py-1 text-xs border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row, rowIndex) => (
                            <tr
                                key={startIndex + rowIndex}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <td
                                    className="px-3 py-2 border-b text-xs"
                                    style={{ borderColor: colors.cardBorder, color: colors.muted }}
                                >
                                    {startIndex + rowIndex + 1}
                                </td>
                                {columns.map(column => {
                                    const value = (row as any)[column.name];
                                    const displayValue = value == null ? '(null)' : String(value);

                                    return (
                                        <td
                                            key={column.name}
                                            className="px-3 py-2 border-b"
                                            style={{
                                                borderColor: colors.cardBorder,
                                                color: value == null ? colors.muted : colors.text
                                            }}
                                            title={displayValue}
                                        >
                                            <div className="max-w-xs truncate">
                                                {displayValue}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {paginatedData.length === 0 && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Table className="w-12 h-12 mx-auto mb-3" style={{ color: colors.muted }} />
                            <p style={{ color: colors.text }} className="font-medium mb-1">No data found</p>
                            <p style={{ color: colors.muted }} className="text-sm">
                                {searchTerm || Object.keys(columnFilters).length > 0
                                    ? 'Try adjusting your filters'
                                    : 'This dataset is empty'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {filteredData.length > 0 && (
                <div
                    className="px-4 py-3 border-t flex items-center justify-between"
                    style={{ borderColor: colors.cardBorder }}
                >
                    <div className="flex items-center gap-4">
                        <span style={{ color: colors.text }} className="text-sm">
                            Showing {startIndex + 1}-{endIndex} of {filteredData.length.toLocaleString()}
                        </span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }}
                        >
                            <option value="25">25 rows</option>
                            <option value="50">50 rows</option>
                            <option value="100">100 rows</option>
                            <option value="250">250 rows</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ borderColor: colors.cardBorder, color: colors.text }}
                        >
                            First
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ borderColor: colors.cardBorder, color: colors.text }}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span style={{ color: colors.text }} className="text-sm px-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ borderColor: colors.cardBorder, color: colors.text }}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ borderColor: colors.cardBorder, color: colors.text }}
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
