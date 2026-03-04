"use client";

import Link from "next/link";
import { formatUsd, formatPct } from "@/lib/format";
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
    ? `https://app.morpho.org/vault?vault=${bestVaultAddress}&network=${bestVaultChainId === 8453 ? "base" : "mainnet"}`
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
