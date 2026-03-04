"use client";

interface DashboardMetricCardProps {
  label: string;
  value: string;
  sub: string;
  colorClass?: string;
  bgClass?: string;
  loading?: boolean;
}

export default function DashboardMetricCard({
  label,
  value,
  sub,
  colorClass,
  bgClass,
  loading,
}: DashboardMetricCardProps) {
  return (
    <div
      className={`border rounded-lg px-3 py-2.5 hover:brightness-110 transition-all cursor-pointer h-full ${bgClass || "bg-gray-900 border-gray-800 hover:border-gray-700"}`}
    >
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold font-mono leading-tight ${colorClass || "text-gray-100"} ${loading ? "animate-pulse" : ""}`}
      >
        {loading ? "..." : value}
      </p>
      <p className="mt-0.5 text-[10px] text-gray-600 truncate leading-tight">
        {sub}
      </p>
    </div>
  );
}
