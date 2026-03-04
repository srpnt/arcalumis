"use client";

import type { RiskAssessment } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";

interface RiskBreakdownProps {
  risk: RiskAssessment;
}

function getAgeLabel(days: number): string {
  if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m — Veteran`;
  if (days > 180) return `${Math.floor(days / 30)} months — Established`;
  if (days > 90) return `${Math.floor(days / 30)} months — Maturing`;
  if (days > 30) return `${days} days — Young`;
  if (days > 0) return `${days} days — New`;
  return "Unknown";
}

export default function RiskBreakdown({ risk }: RiskBreakdownProps) {
  const organicPct = risk.organicSpread > 0 && risk.organicSpread + risk.rewardSpread > 0
    ? risk.organicSpread / (risk.organicSpread + risk.rewardSpread)
    : risk.rewardSpread === 0 ? 1 : 0;
  const rewardPct = 1 - organicPct;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
      {/* Collateral Quality */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Collateral Quality
        </h4>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold border ${
              risk.collateralTier === 1
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : risk.collateralTier === 2
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : risk.collateralTier === 3
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-red-500/15 border-red-500/30 text-red-400"
            }`}
          >
            T{risk.collateralTier}
          </span>
          <span className="text-sm text-gray-300">{risk.collateralTierLabel}</span>
        </div>
      </div>

      {/* Utilization */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Utilization
        </h4>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className={`font-mono font-bold ${
              risk.utilization < 0.7
                ? "text-emerald-400"
                : risk.utilization < 0.85
                ? "text-amber-400"
                : "text-red-400"
            }`}>
              {formatPct(risk.utilization)}
            </span>
            <span className="text-gray-500">
              {formatUsd(risk.liquidityUsd)} avail.
            </span>
          </div>
          {/* Bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                risk.utilization < 0.7
                  ? "bg-emerald-500"
                  : risk.utilization < 0.85
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${Math.min(100, risk.utilization * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-gray-600">
            <span>0%</span>
            <span className="border-l border-gray-700 pl-1">70%</span>
            <span className="border-l border-gray-700 pl-1">85%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Spread Composition */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Spread Composition
        </h4>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">
              <span className="text-emerald-400">●</span> Organic{" "}
              <span className="font-mono text-emerald-400">{(organicPct * 100).toFixed(0)}%</span>
            </span>
            <span className="text-gray-400">
              <span className="text-violet-400">●</span> Rewards{" "}
              <span className="font-mono text-violet-400">{(rewardPct * 100).toFixed(0)}%</span>
            </span>
          </div>
          {/* Stacked bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
            {organicPct > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${organicPct * 100}%` }}
              />
            )}
            {rewardPct > 0 && (
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${rewardPct * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>
              Organic: {formatPct(Math.abs(risk.organicSpread))}
            </span>
            <span>
              Rewards: {formatPct(risk.rewardSpread)}
            </span>
          </div>
        </div>
      </div>

      {/* Market Age */}
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-lg p-3">
        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Market Maturity
        </h4>
        <div className="space-y-1">
          <span className={`text-sm font-bold ${
            risk.marketAgeDays > 180
              ? "text-emerald-400"
              : risk.marketAgeDays > 90
              ? "text-blue-400"
              : risk.marketAgeDays > 30
              ? "text-amber-400"
              : "text-red-400"
          }`}>
            {risk.marketAgeDays > 0 ? `${risk.marketAgeDays} days` : "Unknown"}
          </span>
          <p className="text-xs text-gray-500">
            {getAgeLabel(risk.marketAgeDays)}
          </p>
        </div>
      </div>
    </div>
  );
}
