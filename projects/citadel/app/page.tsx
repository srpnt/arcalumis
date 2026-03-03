"use client";

import useSWR from "swr";
import Link from "next/link";
import ChainDonut from "@/components/ChainDonut";
import { formatUsd, formatPct } from "@/lib/format";
import type { Signal, MorphoVault } from "@/lib/types";

// --- SWR fetchers ---

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

const MORPHO_VAULTS_QUERY = `
query TopVaults {
  vaults(
    first: 50
    orderBy: TotalAssetsUsd
    orderDirection: Desc
    where: { chainId_in: [1, 8453], listed: true }
  ) {
    items {
      address name symbol
      chain { id network }
      asset { symbol priceUsd }
      state {
        totalAssetsUsd fee apy netApy
        allocation {
          market { uniqueKey loanAsset { symbol } collateralAsset { symbol } }
          supplyAssetsUsd
        }
      }
      metadata { description }
    }
  }
}
`;

interface RawVaultItem {
  address: string;
  name: string;
  symbol: string;
  chain: { id: number; network: string };
  asset: { symbol: string; priceUsd: number };
  state: {
    totalAssetsUsd: number;
    fee: number;
    apy: number;
    netApy: number;
    allocation: Array<{
      market: { uniqueKey: string; loanAsset: { symbol: string }; collateralAsset: { symbol: string } };
      supplyAssetsUsd: number;
    }>;
  };
  metadata: { description: string };
}

async function morphoFetcher(): Promise<{
  vaults: MorphoVault[];
  totalTvl: number;
  ethTvl: number;
  baseTvl: number;
  bestYield: number;
  bestVaultName: string;
  bestVaultAddress: string;
  bestVaultChainId: number;
  topVaults: Array<{ name: string; netApy: number; chain: string; chainId: number }>;
}> {
  const res = await fetch("/api/morpho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: MORPHO_VAULTS_QUERY }),
  });
  const json = await res.json();
  const items: RawVaultItem[] = json.data?.vaults?.items || [];

  const vaults: MorphoVault[] = [];
  let totalTvl = 0;
  let ethTvl = 0;
  let baseTvl = 0;
  let bestYield = 0;
  let bestVaultName = "";
  let bestVaultAddress = "";
  let bestVaultChainId = 1;

  const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base" };

  for (const v of items) {
    const state = v.state || ({} as RawVaultItem["state"]);
    const chainId = v.chain?.id ?? 1;
    const apy = Number(state.apy) || 0;
    const netApy = Number(state.netApy) || 0;
    const tvl = Number(state.totalAssetsUsd) || 0;

    if (apy > 1.0 || netApy > 1.0) continue;

    totalTvl += tvl;
    if (chainId === 1) ethTvl += tvl;
    if (chainId === 8453) baseTvl += tvl;

    if (netApy > bestYield) {
      bestYield = netApy;
      bestVaultName = v.name || "";
      bestVaultAddress = v.address || "";
      bestVaultChainId = chainId;
    }

    vaults.push({
      address: v.address,
      name: v.name,
      symbol: v.symbol,
      chainId,
      chain: CHAIN_NAMES[chainId] || String(chainId),
      underlyingAsset: v.asset?.symbol || "?",
      totalAssetsUsd: tvl,
      apy,
      netApy,
      fee: Number(state.fee) || 0,
      description: (v.metadata?.description || "").slice(0, 200),
      numMarkets: (state.allocation || []).length,
    });
  }

  // Top yielding vaults sorted by netApy
  const topVaults = [...vaults]
    .sort((a, b) => b.netApy - a.netApy)
    .slice(0, 3)
    .map((v) => ({ name: v.name, netApy: v.netApy, chain: v.chain, chainId: v.chainId }));

  return { vaults, totalTvl, ethTvl, baseTvl, bestYield, bestVaultName, bestVaultAddress, bestVaultChainId, topVaults };
}

// --- Urgency helpers ---

const URGENCY_EMOJI: Record<string, string> = {
  critical: "🔴",
  notable: "🟡",
  info: "🟢",
};

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "< 1h ago";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// --- Component ---

export default function Home() {
  const { data: morphoData, isLoading: morphoLoading } = useSWR("morpho-home", morphoFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const { data: signalsData, isLoading: signalsLoading } = useSWR<{ signals: Signal[] }>(
    "/api/signals",
    jsonFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );

  const { data: whalesData } = useSWR<{ whales: Array<{ address: string; label: string; notes: string; lastBalance: number; lastChecked: string }> }>(
    "/api/whales",
    jsonFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );

  const { data: exposureData } = useSWR<{
    tier4ExposureUsd: number;
    totalExposureUsd: number;
    totalAssetsTracked: number;
  }>("/api/exposure", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const totalTvl = morphoData?.totalTvl ?? 0;
  const ethTvl = morphoData?.ethTvl ?? 0;
  const baseTvl = morphoData?.baseTvl ?? 0;
  const bestYield = morphoData?.bestYield ?? 0;
  const bestVaultName = morphoData?.bestVaultName ?? "—";
  const bestVaultAddress = morphoData?.bestVaultAddress ?? "";
  const bestVaultChainId = morphoData?.bestVaultChainId ?? 1;
  const topVaults = morphoData?.topVaults ?? [];
  const signals = signalsData?.signals ?? [];
  const whales = whalesData?.whales ?? [];
  const tier4Usd = exposureData?.tier4ExposureUsd ?? 0;
  const criticalSignals = signals.filter((s) => s.urgency === "critical").length;

  const marketsCount = morphoData?.vaults?.length ?? 0;

  const morphoVaultUrl = bestVaultAddress
    ? `https://app.morpho.org/vault?vault=${bestVaultAddress}&network=${bestVaultChainId === 8453 ? "base" : "mainnet"}`
    : "/morpho";

  const loading = morphoLoading || signalsLoading;

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <span className="text-xs text-gray-600">
          {loading ? "Refreshing..." : `Updated ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </div>

      {/* Row 1: Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Link href="/morpho">
          <MetricCard label="Total TVL" value={formatUsd(totalTvl)} sub="Across all vaults" loading={morphoLoading} />
        </Link>
        <a href={morphoVaultUrl} target="_blank" rel="noopener noreferrer">
          <MetricCard label="🔥 Best Yield" value={formatPct(bestYield)} sub={bestVaultName} accent loading={morphoLoading} />
        </a>
        <Link href="/signals">
          <MetricCard label="Active Signals" value={String(signals.length)} sub="From research scans" loading={signalsLoading} />
        </Link>
        <Link href="/morpho">
          <MetricCard label="Vaults Tracked" value={String(marketsCount)} sub="Ethereum + Base" loading={morphoLoading} />
        </Link>
      </div>

      {/* Row 2: Activity Feed (2/3) + Risk Overview (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Left: Activity Feed */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Activity Feed</h2>
          </div>

          {/* Section: Latest Signals */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">📡 Latest Signals</h3>
              <Link href="/signals" className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors">
                View all →
              </Link>
            </div>
            {signals.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No signals detected</p>
            ) : (
              signals.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 border-l-2 border-gray-800 pl-3 hover:border-emerald-500/40 transition-colors">
                  <span className="text-sm shrink-0">{URGENCY_EMOJI[s.urgency] || "⚪"}</span>
                  <span className="text-sm text-gray-300 truncate flex-1">{s.title.replace(/^[🔴🟡🟢]\s*/, "")}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(s.date)}</span>
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/60 my-4" />

          {/* Section: Top Yielding Vaults */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">📊 Top Yielding Vaults</h3>
              <Link href="/morpho" className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors">
                View all →
              </Link>
            </div>
            {topVaults.length === 0 ? (
              <p className="text-xs text-gray-600 italic">Loading vault data...</p>
            ) : (
              topVaults.map((v, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-l-2 border-gray-800 pl-3 hover:border-emerald-500/40 transition-colors">
                  <span className="text-sm text-gray-300 truncate flex-1">{v.name}</span>
                  <span className="text-sm font-mono text-emerald-400 shrink-0">{formatPct(v.netApy)}</span>
                  <ChainBadge chain={v.chain} />
                </div>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/60 my-4" />

          {/* Section: Whale Activity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">🐋 Whale Activity</h3>
              <Link href="/intel" className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors">
                View all →
              </Link>
            </div>
            {whales.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No whales on watchlist</p>
            ) : (
              <div className="py-1.5 border-l-2 border-gray-800 pl-3">
                <p className="text-sm text-gray-300">
                  👁 Watching <span className="text-gray-100 font-medium">{whales.length}</span> whales
                  {" · "}
                  <span className="text-gray-400">
                    {formatUsd(whales.reduce((s, w) => s + (w.lastBalance || 0), 0))} tracked
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Risk Overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Risk Overview</h2>

          {/* Tier 4 Exotic Exposure — prominent */}
          <div className="mb-5">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              🔴 Exotic Exposure (Tier 4)
            </h3>
            <p className="text-3xl font-bold text-red-400 font-mono">
              {tier4Usd > 0 ? formatUsd(tier4Usd) : "—"}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              Unclassified collateral in Morpho markets
            </p>
            <Link href="/exposure" className="text-[10px] text-emerald-500 hover:text-emerald-400 mt-1 inline-block">
              View exposure →
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800/60 my-4" />

          {/* Chain Distribution Donut */}
          <ChainDonut ethTvl={ethTvl} baseTvl={baseTvl} />

          {/* Critical Signals */}
          {criticalSignals > 0 && (
            <>
              <div className="border-t border-gray-800/60 my-4" />
              <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-400">
                  🔴 {criticalSignals} critical signal{criticalSignals !== 1 ? "s" : ""}
                </p>
                <Link href="/signals" className="text-[10px] text-red-400/70 hover:text-red-300 mt-1 inline-block">
                  Review signals →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-700 mt-8">
        Citadel v0.2 · Powered by Arcalumis 🦞
      </div>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer h-full">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1.5 text-xl font-bold font-mono ${accent ? "text-emerald-400" : "text-gray-100"} ${loading ? "animate-pulse" : ""}`}>
        {loading ? "..." : value}
      </p>
      <p className="mt-0.5 text-[10px] text-gray-600 truncate">{sub}</p>
    </div>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  const color = chain === "Ethereum" ? "text-emerald-400 bg-emerald-500/10" : "text-blue-400 bg-blue-500/10";
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${color} shrink-0`}>
      {chain === "Ethereum" ? "ETH" : chain === "Base" ? "BASE" : chain}
    </span>
  );
}
