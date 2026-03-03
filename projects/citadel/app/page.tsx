"use client";

import useSWR from "swr";
import Link from "next/link";
import { formatUsd, formatPct } from "@/lib/format";
import type { Signal, MorphoVault } from "@/lib/types";
import { useState, useEffect } from "react";

// ============================================================
// Fetchers
// ============================================================

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
          market {
            uniqueKey
            loanAsset { symbol }
            collateralAsset { symbol }
            state { utilization borrowAssetsUsd supplyAssetsUsd }
          }
          supplyAssetsUsd
        }
      }
      metadata { description }
    }
  }
}
`;

interface MarketState {
  utilization: number | null;
  borrowAssetsUsd: number | null;
  supplyAssetsUsd: number | null;
}

interface AllocationItem {
  market: {
    uniqueKey: string;
    loanAsset: { symbol: string };
    collateralAsset: { symbol: string };
    state: MarketState;
  };
  supplyAssetsUsd: number;
}

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
    allocation: AllocationItem[];
  };
  metadata: { description: string };
}

interface VaultWithUtilization extends MorphoVault {
  avgUtilization: number;
  highUtilMarkets: Array<{
    collateral: string;
    loan: string;
    utilization: number;
    chainId: number;
  }>;
}

interface MorphoDashData {
  vaults: VaultWithUtilization[];
  totalTvl: number;
  avgUtilization: number;
  bestYield: number;
  bestVaultName: string;
  bestVaultAddress: string;
  bestVaultChainId: number;
  topVaults: Array<{
    name: string;
    netApy: number;
    chain: string;
    chainId: number;
    asset: string;
    address: string;
  }>;
  highUtilVaults: Array<{
    name: string;
    chain: string;
    chainId: number;
    avgUtilization: number;
    netApy: number;
    address: string;
  }>;
}

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base" };

function sf(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

async function morphoFetcher(): Promise<MorphoDashData> {
  const res = await fetch("/api/morpho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: MORPHO_VAULTS_QUERY }),
  });
  const json = await res.json();
  const items: RawVaultItem[] = json.data?.vaults?.items || [];

  const vaults: VaultWithUtilization[] = [];
  let totalTvl = 0;
  let bestYield = 0;
  let bestVaultName = "";
  let bestVaultAddress = "";
  let bestVaultChainId = 1;
  let weightedUtilSum = 0;
  let weightedUtilDenom = 0;

  for (const v of items) {
    const state = v.state || ({} as RawVaultItem["state"]);
    const chainId = v.chain?.id ?? 1;
    const apy = Number(state.apy) || 0;
    const netApy = Number(state.netApy) || 0;
    const tvl = Number(state.totalAssetsUsd) || 0;

    if (apy > 1.0 || netApy > 1.0) continue;

    totalTvl += tvl;

    if (netApy > bestYield) {
      bestYield = netApy;
      bestVaultName = v.name || "";
      bestVaultAddress = v.address || "";
      bestVaultChainId = chainId;
    }

    // Calculate weighted avg utilization for this vault
    const alloc = state.allocation || [];
    let vaultUtilSum = 0;
    let vaultUtilWeight = 0;
    const highUtilMarkets: VaultWithUtilization["highUtilMarkets"] = [];

    for (const a of alloc) {
      const mState = a.market?.state;
      const util = sf(mState?.utilization);
      const allocUsd = sf(a.supplyAssetsUsd);
      if (allocUsd > 0 && util > 0) {
        vaultUtilSum += util * allocUsd;
        vaultUtilWeight += allocUsd;
      }
      if (util > 0.9) {
        highUtilMarkets.push({
          collateral: a.market?.collateralAsset?.symbol || "?",
          loan: a.market?.loanAsset?.symbol || "?",
          utilization: util,
          chainId,
        });
      }
    }

    const avgUtil = vaultUtilWeight > 0 ? vaultUtilSum / vaultUtilWeight : 0;
    weightedUtilSum += avgUtil * tvl;
    weightedUtilDenom += tvl;

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
      numMarkets: alloc.length,
      avgUtilization: avgUtil,
      highUtilMarkets,
    });
  }

  const avgUtilization = weightedUtilDenom > 0 ? weightedUtilSum / weightedUtilDenom : 0;

  const topVaults = [...vaults]
    .sort((a, b) => b.netApy - a.netApy)
    .slice(0, 3)
    .map((v) => ({
      name: v.name,
      netApy: v.netApy,
      chain: v.chain,
      chainId: v.chainId,
      asset: v.underlyingAsset,
      address: v.address,
    }));

  const highUtilVaults = [...vaults]
    .filter((v) => v.avgUtilization > 0.9)
    .sort((a, b) => b.avgUtilization - a.avgUtilization)
    .slice(0, 10)
    .map((v) => ({
      name: v.name,
      chain: v.chain,
      chainId: v.chainId,
      avgUtilization: v.avgUtilization,
      netApy: v.netApy,
      address: v.address,
    }));

  return {
    vaults,
    totalTvl,
    avgUtilization,
    bestYield,
    bestVaultName,
    bestVaultAddress,
    bestVaultChainId,
    topVaults,
    highUtilVaults,
  };
}

// ============================================================
// Gas price fetcher (Etherscan V2)
// ============================================================

interface GasData {
  safeGwei: number;
  proposeGwei: number;
  fastGwei: number;
}

async function fetchGas(): Promise<GasData> {
  const res = await fetch(
    "https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle"
  );
  const json = await res.json();
  const r = json.result || {};
  return {
    safeGwei: parseFloat(r.SafeGasPrice) || 0,
    proposeGwei: parseFloat(r.ProposeGasPrice) || 0,
    fastGwei: parseFloat(r.FastGasPrice) || 0,
  };
}

// ============================================================
// Stablecoin fetcher (CoinGecko)
// ============================================================

interface StablecoinData {
  usdc: number;
  usdt: number;
  usde: number;
}

async function fetchStablecoins(): Promise<StablecoinData> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,ethena-usde&vs_currencies=usd"
  );
  const json = await res.json();
  return {
    usdc: json["usd-coin"]?.usd ?? 0,
    usdt: json["tether"]?.usd ?? 0,
    usde: json["ethena-usde"]?.usd ?? 0,
  };
}

// ============================================================
// Urgency helpers
// ============================================================

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

function pegColor(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "text-red-400";
  if (deviation > 0.002) return "text-amber-400";
  return "text-emerald-400";
}

function pegStatus(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "OFF-PEG";
  if (deviation > 0.002) return "DRIFT";
  return "ON-PEG";
}

function pegDot(price: number): string {
  const deviation = Math.abs(price - 1);
  if (deviation > 0.005) return "bg-red-500";
  if (deviation > 0.002) return "bg-amber-500";
  return "bg-emerald-500";
}

// ============================================================
// Component
// ============================================================

export default function Home() {
  // Morpho data
  const { data: morphoData, isLoading: morphoLoading } = useSWR(
    "morpho-dash",
    morphoFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );

  // Signals
  const { data: signalsData, isLoading: signalsLoading } = useSWR<{
    signals: Signal[];
  }>("/api/signals", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  // Exposure (tier data)
  const { data: exposureData } = useSWR<{
    tier4ExposureUsd: number;
    totalExposureUsd: number;
    totalAssetsTracked: number;
    assets: Array<{ symbol: string; tier: number; totalExposureUsd: number }>;
  }>("/api/exposure", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  // Whales (concentration)
  const { data: whalesData } = useSWR<{
    whales: Array<{
      address: string;
      label: string;
      notes: string;
      lastBalance: number;
      source: string;
    }>;
  }>("/api/whales", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  // Gas price (client-side, direct)
  const [gasData, setGasData] = useState<GasData | null>(null);
  useEffect(() => {
    fetchGas().then(setGasData).catch(() => {});
    const iv = setInterval(() => {
      fetchGas().then(setGasData).catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Stablecoin prices (client-side, direct)
  const [stableData, setStableData] = useState<StablecoinData | null>(null);
  useEffect(() => {
    fetchStablecoins().then(setStableData).catch(() => {});
    const iv = setInterval(() => {
      fetchStablecoins().then(setStableData).catch(() => {});
    }, 120_000);
    return () => clearInterval(iv);
  }, []);

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

  // Concentration: vault whales with notes about "Top depositor"
  const vaultWhales = whales.filter(
    (w) => w.source === "morpho-vault-whale" && w.notes
  );
  // Parse concentration from notes — find highest single deposit
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
  const loading = morphoLoading || signalsLoading;

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
          <MetricCard
            label="Total TVL"
            value={formatUsd(totalTvl)}
            sub="All listed vaults"
            loading={morphoLoading}
          />
        </Link>

        <MetricCard
          label="Avg Utilization"
          value={formatPct(avgUtil)}
          sub="Weighted by TVL"
          loading={morphoLoading}
          colorClass={utilizationColor(avgUtil)}
          bgClass={utilizationBg(avgUtil)}
        />

        <a href={morphoVaultUrl} target="_blank" rel="noopener noreferrer">
          <MetricCard
            label="🔥 Best Yield"
            value={formatPct(bestYield)}
            sub={bestVaultName}
            colorClass="text-emerald-400"
            loading={morphoLoading}
          />
        </a>

        <Link href="/exposure">
          <MetricCard
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

        <MetricCard
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
          {/* Section A: Utilization Alerts */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Utilization Alerts
                <span className="relative group">
                  <span className="cursor-help text-gray-600 hover:text-gray-400 transition-colors">ⓘ</span>
                  <span className="absolute left-6 top-0 z-50 hidden group-hover:block w-64 p-2 text-[11px] text-gray-300 bg-gray-800 border border-gray-700 rounded-lg shadow-xl leading-relaxed">
                    Vaults with utilization &gt;85% are under withdrawal pressure. At &gt;95%, the IRM pushes borrow rates to 190%+ APR (emergency mode). Borrowers can&apos;t withdraw, depositors face illiquidity.
                  </span>
                </span>
              </h2>
              <span className="text-[10px] text-gray-600 font-mono">
                {highUtilVaults.length > 0
                  ? `${highUtilVaults.length} VAULTS &gt;90%`
                  : "ALL CLEAR"}
              </span>
            </div>
            {highUtilVaults.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-1">
                No vaults above 90% utilization
              </p>
            ) : (
              <div className="space-y-1">
                {highUtilVaults.map((v, i) => (
                  <a
                    key={i}
                    href={`https://app.morpho.org/vault?vault=${v.address}&network=${v.chainId === 8453 ? "base" : "mainnet"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors group"
                  >
                    <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-gray-100">
                      {v.name}
                    </span>
                    <ChainBadge chain={v.chain} />
                    <span
                      className={`text-xs font-mono font-semibold ${utilizationColor(v.avgUtilization)} tabular-nums`}
                    >
                      {formatPct(v.avgUtilization, 1)}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono tabular-nums w-16 text-right">
                      {formatPct(v.netApy, 1)} APY
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Rate Opportunities */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Rate Opportunities
              </h2>
              <Link
                href="/morpho"
                className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                View all →
              </Link>
            </div>
            {topVaults.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-1">
                Loading vault data...
              </p>
            ) : (
              <div className="space-y-1">
                {topVaults.map((v, i) => (
                  <a
                    key={i}
                    href={`https://app.morpho.org/vault?vault=${v.address}&network=${v.chainId === 8453 ? "base" : "mainnet"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors group"
                  >
                    <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-gray-100">
                      {v.name}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {v.asset}
                    </span>
                    <ChainBadge chain={v.chain} />
                    <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                      {formatPct(v.netApy, 1)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Recent Signals */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                Recent Signals
              </h2>
              <Link
                href="/signals"
                className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                View all →
              </Link>
            </div>
            {signals.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-1">
                No signals detected
              </p>
            ) : (
              <div className="space-y-1">
                {signals.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors"
                  >
                    <span className="text-sm shrink-0">
                      {URGENCY_EMOJI[s.urgency] || "⚪"}
                    </span>
                    <span className="text-xs text-gray-300 truncate flex-1">
                      {s.title.replace(/^[🔴🟡🟢]\s*/, "")}
                    </span>
                    <span className="text-[10px] text-gray-600 shrink-0 font-mono tabular-nums">
                      {timeAgo(s.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Risk Panel */}
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
              href="/exposure"
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
          {signals.filter((s) => s.urgency === "critical").length > 0 && (
            <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-400">
                🔴{" "}
                {signals.filter((s) => s.urgency === "critical").length}{" "}
                critical signal
                {signals.filter((s) => s.urgency === "critical").length !== 1
                  ? "s"
                  : ""}
              </p>
              <Link
                href="/signals"
                className="text-[10px] text-red-400/70 hover:text-red-300 mt-1 inline-block"
              >
                Review now →
              </Link>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function MetricCard({
  label,
  value,
  sub,
  colorClass,
  bgClass,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  colorClass?: string;
  bgClass?: string;
  loading?: boolean;
}) {
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

function ChainBadge({ chain }: { chain: string }) {
  const color =
    chain === "Ethereum"
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-blue-400 bg-blue-500/10";
  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${color} shrink-0`}
    >
      {chain === "Ethereum" ? "ETH" : chain === "Base" ? "BASE" : chain}
    </span>
  );
}

function StablecoinRow({ label, price }: { label: string; price: number }) {
  if (!price) return null;
  const color = pegColor(price);
  const status = pegStatus(price);
  const dot = pegDot(price);
  const deviation = ((price - 1) * 100).toFixed(3);
  const sign = parseFloat(deviation) >= 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className="text-xs font-medium text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-500 tabular-nums">
          ${price.toFixed(4)}
        </span>
        <span
          className={`text-[9px] font-mono font-semibold ${color} tabular-nums`}
        >
          {sign}
          {deviation}%
        </span>
        <span
          className={`text-[9px] font-semibold px-1 py-0.5 rounded ${color} ${parseFloat(deviation) === 0 && status === "ON-PEG" ? "bg-emerald-500/10" : Math.abs(parseFloat(deviation)) > 0.5 ? "bg-red-500/10" : "bg-emerald-500/10"}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
