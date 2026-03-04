"use client";

import { useState, useRef, useEffect } from "react";
import type { RiskAssessment } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";

interface RiskBadgeProps {
  risk: RiskAssessment;
}

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTooltip]);

  let bg: string;
  let text: string;
  let ring: string;

  if (risk.score >= 8) {
    bg = "bg-emerald-500/15 border-emerald-500/30";
    text = "text-emerald-400";
    ring = "ring-emerald-500/20";
  } else if (risk.score >= 5) {
    bg = "bg-amber-500/15 border-amber-500/30";
    text = "text-amber-400";
    ring = "ring-amber-500/20";
  } else {
    bg = "bg-red-500/15 border-red-500/30";
    text = "text-red-400";
    ring = "ring-red-500/20";
  }

  return (
    <div className="relative inline-flex">
      <div
        ref={badgeRef}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold font-mono cursor-help ${bg} ${text}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>{risk.score.toFixed(1)}</span>
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl ring-1 ${ring}`}
        >
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-700" />

          <div className="text-xs space-y-2">
            <div className="flex justify-between items-center border-b border-gray-700 pb-1.5">
              <span className="font-semibold text-gray-300">Risk Score</span>
              <span className={`font-bold ${text}`}>
                {risk.score.toFixed(1)}/10 — {risk.scoreLabel}
              </span>
            </div>

            {/* Collateral */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Collateral</span>
              <span className="text-gray-300">
                Tier {risk.collateralTier}{" "}
                <span className="text-gray-500">({risk.collateralTierLabel})</span>
              </span>
            </div>

            {/* Utilization */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Utilization</span>
              <span className={`font-mono ${
                risk.utilization < 0.7
                  ? "text-emerald-400"
                  : risk.utilization < 0.85
                  ? "text-amber-400"
                  : "text-red-400"
              }`}>
                {formatPct(risk.utilization)}
              </span>
            </div>

            {/* Reward dependency */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Reward Dep.</span>
              <span className={`font-mono ${
                risk.rewardDependencyPct < 0.3
                  ? "text-emerald-400"
                  : risk.rewardDependencyPct < 0.6
                  ? "text-amber-400"
                  : "text-red-400"
              }`}>
                {formatPct(risk.rewardDependencyPct)}
              </span>
            </div>

            {/* Market Age */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Market Age</span>
              <span className="text-gray-300">
                {risk.marketAgeDays > 0 ? `${risk.marketAgeDays}d` : "Unknown"}
              </span>
            </div>

            {/* Liquidity */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Liquidity</span>
              <span className="text-gray-300 font-mono">
                {formatUsd(risk.liquidityUsd)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
