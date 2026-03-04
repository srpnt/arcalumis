"use client";

import { formatUsd } from "@/lib/format";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown>; name: string; value: number }>;
}

export function TreemapTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-200 font-medium">{String(d.name)}</p>
      <p className="text-gray-400">{String(d.exposure)}</p>
      <p className="text-gray-500 text-xs">{String(d.tierLabel)}</p>
    </div>
  );
}

export function DonutTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-200 font-medium">{d.name}</p>
      <p className="text-gray-400">{formatUsd(d.value)}</p>
    </div>
  );
}
