"use client";

import Link from "next/link";
import { formatUsd } from "@/lib/format";
import type { Signal } from "@/lib/types";
import StablecoinRow from "./StablecoinRow";

interface StablecoinData {
  usdc: number;
  usdt: number;
  usde: number;
}

interface ConcentrationEntry {
  vault: string;
  amount: number;
  label: string;
  address: string;
}

interface RiskPanelProps {
  tier4Usd: number;
  tier4Count: number;
  highConcCount: number;
  worstConcentration: ConcentrationEntry | undefined;
  stableData: StablecoinData | null;
  signals: Signal[];
}

export default function RiskPanel({
  tier4Usd,
  tier4Count,
  highConcCount,
  worstConcentration,
  stableData,
  signals,
}: RiskPanelProps) {
  const criticalCount = signals.filter((s) => s.urgency === "critical").length;

  return (
    <div className="space-y-3">
      {/* Collateral Risk */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Collateral Risk
          <span className="relative group">
            <span className="cursor-help text-gray-600 hover:text-gray-400 transition-colors">ⓘ</span>
            <span className="absolute left-0 top-6 z-50 hidden group-hover:block w-64 p-2 text-[11px] text-gray-300 bg-gray-800 border border-gray-700 rounded-lg shadow-xl leading-relaxed">
              Tier 4 &quot;Exotic&quot; collateral includes unproven stablecoins, wrapped derivatives, and thin-liquidity tokens. When these depeg, liquidation is often impossible — see MEV Capital sdeUSD incident (99.8% loss, $1.3M bad debt).
            </span>
          </span>
        </h2>
        <div className="mb-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
            Tier 4 Exotic Exposure
          </p>
          <p
            className={`text-2xl font-bold font-mono ${tier4Usd > 500_000_000 ? "text-red-400" : "text-amber-400"}`}
          >
            {tier4Usd > 0 ? formatUsd(tier4Usd) : "—"}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {tier4Count} unclassified collateral assets
          </p>
        </div>
        <Link
          href="/risk"
          className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          View details →
        </Link>
      </div>

      {/* Concentration Risk */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          Concentration Risk
          <span className="relative group">
            <span className="cursor-help text-gray-600 hover:text-gray-400 transition-colors">ⓘ</span>
            <span className="absolute left-0 top-6 z-50 hidden group-hover:block w-64 p-2 text-[11px] text-gray-300 bg-gray-800 border border-gray-700 rounded-lg shadow-xl leading-relaxed">
              Vaults where a single depositor holds &gt;50% of TVL face withdrawal shock risk. If that whale exits, utilization spikes, remaining depositors may be unable to withdraw.
            </span>
          </span>
        </h2>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Large Single Depositors
            </p>
            <p className="text-lg font-bold font-mono text-gray-100">
              {highConcCount}
            </p>
            <p className="text-[10px] text-gray-600">
              vaults with dominant depositor
            </p>
          </div>
          {worstConcentration && (
            <div className="border-t border-gray-800/60 pt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                Highest Concentration
              </p>
              <p className="text-xs text-gray-300 truncate">
                {worstConcentration.vault}
              </p>
              <p className="text-xs font-mono text-amber-400">
                ${worstConcentration.amount.toLocaleString()} by{" "}
                <span className="text-gray-500">
                  {worstConcentration.label}
                </span>
              </p>
            </div>
          )}
        </div>
        <Link
          href="/intel"
          className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors mt-2 inline-block"
        >
          View whale data →
        </Link>
      </div>

      {/* Stablecoin Health */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Stablecoin Health
        </h2>
        {!stableData ? (
          <p className="text-xs text-gray-600 italic">Loading...</p>
        ) : (
          <div className="space-y-2">
            <StablecoinRow label="USDC" price={stableData.usdc} />
            <StablecoinRow label="USDT" price={stableData.usdt} />
            <StablecoinRow label="USDe" price={stableData.usde} />
          </div>
        )}
      </div>

      {/* Critical Signals Alert */}
      {criticalCount > 0 && (
        <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-400">
            🔴{" "}
            {criticalCount} critical signal
            {criticalCount !== 1 ? "s" : ""}
          </p>
          <Link
            href="/risk"
            className="text-[10px] text-red-400/70 hover:text-red-300 mt-1 inline-block"
          >
            Review now →
          </Link>
        </div>
      )}
    </div>
  );
}
