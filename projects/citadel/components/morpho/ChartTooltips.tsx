"use client";

import { formatUsd, formatPct } from "@/lib/format";

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown>; value: number }>;
}

export function VaultBarTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-200 font-medium">{String(d.name)}</p>
      <p className="text-gray-400">TVL: {formatUsd(Number(d.tvl))}</p>
      <p className="text-gray-500 text-xs">{String(d.chain)}</p>
    </div>
  );
}

interface ScatterTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
}

export function ScatterTooltipContent({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-200 font-medium">{String(d.name)}</p>
      <p className="text-gray-400">TVL: {formatUsd(Number(d.tvl))}</p>
      <p className="text-gray-400">Net APY: {formatPct(Number(d.apy) / 100)}</p>
      <p className="text-gray-500 text-xs">{String(d.chain)} • {String(d.markets)} markets</p>
    </div>
  );
}
