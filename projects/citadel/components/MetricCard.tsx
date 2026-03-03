"use client";

import Link from "next/link";

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  href?: string;
  icon?: string;
}

export default function MetricCard({
  label,
  value,
  subtitle,
  href,
  icon,
}: MetricCardProps) {
  const inner = (
    <div
      className={`
        bg-gray-900 border border-gray-800 rounded-xl p-5
        transition-all duration-200
        ${href ? "hover:border-emerald-500/30 hover:bg-gray-800/50 cursor-pointer" : ""}
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
