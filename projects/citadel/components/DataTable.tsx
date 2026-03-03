"use client";

import React, { useState, useMemo } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  defaultSort?: string;
  defaultSortDesc?: boolean;
  onRowClick?: (row: T) => void;
  expandedContent?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  defaultSortDesc = true,
  onRowClick,
  expandedContent,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSort || "");
  const [sortDesc, setSortDesc] = useState(defaultSortDesc);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDesc ? bVal - aVal : aVal - bVal;
      }
      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      return sortDesc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    });
  }, [data, sortKey, sortDesc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`
                  px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                  ${col.sortable !== false ? "cursor-pointer hover:text-gray-300 select-none" : ""}
                `}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-emerald-400">
                      {sortDesc ? "↓" : "↑"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <React.Fragment key={row.uniqueId || row.address || row.id || i}>
              <tr
                className={`
                  border-b border-gray-800/50 transition-colors
                  ${onRowClick || expandedContent ? "cursor-pointer hover:bg-gray-800/30" : ""}
                  ${expandedIdx === i ? "bg-gray-800/30" : ""}
                `}
                onClick={() => {
                  if (expandedContent) {
                    setExpandedIdx(expandedIdx === i ? null : i);
                  }
                  onRowClick?.(row);
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-3 text-gray-300
                      ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}
                    `}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
              {expandedContent && expandedIdx === i && (
                <tr key={`expanded-${i}`}>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-4 bg-gray-900/50 border-b border-gray-800"
                  >
                    {expandedContent(row)}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
