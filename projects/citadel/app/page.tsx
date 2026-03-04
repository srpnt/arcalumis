"use client";

import Link from "next/link";
import useSWR from "swr";
import { formatUsd, formatPct } from "@/lib/format";
import { getMorphoVaultUrl } from "@/lib/chains";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import DashboardMetricCard from "@/components/dashboard/DashboardMetricCard";
import UtilizationAlerts from "@/components/dashboard/UtilizationAlerts";
import RateOpportunities from "@/components/dashboard/RateOpportunities";
import RecentSignals from "@/components/dashboard/RecentSignals";
import RiskPanel from "@/components/dashboard/RiskPanel";

// ============================================================
// Color helpers
// ============================================================

function utilizationColor(u: number): string {
  if (u >= 0.9) return "text-red-400";
  if (u >= 0.8) return "text-amber-400";
  return "text-emerald-400";
}

function utilizationBg(u: number): string {
  if (u >= 0.9) return "bg-red-500/10 border-red-500/20";
  if (u >= 0.8) return "bg-amber-500/10 border-amber-500/20";
  return "bg-emerald-500/10 border-emerald-500/20";
}

function gasColor(gwei: number): string {
  if (gwei >= 100) return "text-red-400";
  if (gwei >= 30) return "text-amber-400";
  return "text-emerald-400";
}

function gasBg(gwei: number): string {
  if (gwei >= 100) return "bg-red-500/10 border-red-500/20";
  if (gwei >= 30) return "bg-amber-500/10 border-amber-500/20";
  return "bg-emerald-500/10 border-emerald-500/20";
}

// ============================================================
// Component
// ============================================================

// Node fetcher that doesn't throw on offline
const nodeFetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

export default function Home() {
  const {
    morphoData,
    morphoLoading,
    signalsData,
    exposureData,
    whalesData,
    gasData,
    stableData,
    loading,
  } = useDashboardData();

  // Execution node positions
  const { data: nodePositions } = useSWR(
    "/api/node/positions",
    nodeFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  const { data: nodeStatus } = useSWR(
    "/api/node/status",
    nodeFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  const positionsCount = nodePositions?.positions?.length ?? 0;
  const nodeOnline = !!nodeStatus;

  // Derived data
  const totalTvl = morphoData?.totalTvl ?? 0;
  const avgUtil = morphoData?.avgUtilization ?? 0;
  const bestYield = morphoData?.bestYield ?? 0;
  const bestVaultName = morphoData?.bestVaultName ?? "—";
  const bestVaultAddress = morphoData?.bestVaultAddress ?? "";
  const bestVaultChainId = morphoData?.bestVaultChainId ?? 1;
  const topVaults = morphoData?.topVaults ?? [];
  const highUtilVaults = morphoData?.highUtilVaults ?? [];
  const signals = signalsData?.signals ?? [];
  const tier4Usd = exposureData?.tier4ExposureUsd ?? 0;
  const tier4Count =
    exposureData?.assets?.filter((a) => a.tier === 4).length ?? 0;
  const whales = whalesData?.whales ?? [];

  // Concentration data
  const vaultWhales = whales.filter(
    (w) => w.source === "morpho-vault-whale" && w.notes
  );
  const concentrations = vaultWhales
    .flatMap((w) => {
      const matches = w.notes.matchAll(
        /Top depositor in ([^:]+):\s*\$([\d,]+)/g
      );
      return [...matches].map((m) => ({
        vault: m[1].trim(),
        amount: parseFloat(m[2].replace(/,/g, "")),
        label: w.label,
        address: w.address,
      }));
    })
    .sort((a, b) => b.amount - a.amount);

  const worstConcentration = concentrations[0];
  const highConcCount = concentrations.length;

  const morphoVaultUrl = bestVaultAddress
    ? getMorphoVaultUrl(bestVaultAddress, bestVaultChainId)
    : "/morpho";

  const gasGwei = gasData?.proposeGwei ?? 0;

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="text-xl font-bold text-gray-100">
          Protocol Health Monitor
        </h1>
        <span className="text-[10px] text-gray-600 font-mono">
          {loading
            ? "⟳ REFRESHING"
            : `UPD ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </div>

      {/* Row 1: Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <Link href="/morpho">
          <DashboardMetricCard
            label="Total TVL"
            value={formatUsd(totalTvl)}
            sub="All listed vaults"
            loading={morphoLoading}
          />
        </Link>

        <DashboardMetricCard
          label="Avg Utilization"
          value={formatPct(avgUtil)}
          sub="Weighted by TVL"
          loading={morphoLoading}
          colorClass={utilizationColor(avgUtil)}
          bgClass={utilizationBg(avgUtil)}
        />

        <a href={morphoVaultUrl} target="_blank" rel="noopener noreferrer">
          <DashboardMetricCard
            label="🔥 Best Yield"
            value={formatPct(bestYield)}
            sub={bestVaultName}
            colorClass="text-emerald-400"
            loading={morphoLoading}
          />
        </a>

        <Link href="/exposure">
          <DashboardMetricCard
            label="Exotic Exposure"
            value={formatUsd(tier4Usd)}
            sub={`${tier4Count} Tier 4 assets`}
            colorClass={tier4Usd > 500_000_000 ? "text-red-400" : "text-amber-400"}
            bgClass={
              tier4Usd > 500_000_000
                ? "bg-red-500/10 border-red-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }
            loading={!exposureData}
          />
        </Link>

        <DashboardMetricCard
          label="⛽ Gas"
          value={gasGwei > 0 ? `${gasGwei.toFixed(1)} gwei` : "—"}
          sub="ETH standard"
          colorClass={gasColor(gasGwei)}
          bgClass={gasBg(gasGwei)}
          loading={!gasData}
        />
      </div>

      {/* Execution Node Card */}
      <div className="mb-4">
        <Link href="/execution">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏰</span>
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    Active Positions
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {nodeOnline
                      ? positionsCount > 0
                        ? `${positionsCount} open position${positionsCount !== 1 ? "s" : ""}`
                        : "No open positions"
                      : "Node offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    nodeOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                  }`}
                />
                <span className="text-xs text-gray-600">→</span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Row 2: Protocol Monitor (2/3) + Risk Panel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Protocol Monitor */}
        <div className="lg:col-span-2 space-y-3">
          <UtilizationAlerts highUtilVaults={highUtilVaults} />
          <RateOpportunities topVaults={topVaults} />
          <RecentSignals signals={signals} />
        </div>

        {/* Right: Risk Panel */}
        <RiskPanel
          tier4Usd={tier4Usd}
          tier4Count={tier4Count}
          highConcCount={highConcCount}
          worstConcentration={worstConcentration}
          stableData={stableData}
          signals={signals}
        />
      </div>
    </div>
  );
}
