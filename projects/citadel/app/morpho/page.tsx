"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, CartesianGrid, Cell, ReferenceLine, Label,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import ChainBadge from "@/components/ChainBadge";
import DataTable from "@/components/DataTable";
import HotVaultCard from "@/components/morpho/HotVaultCard";
import { VaultBarTooltip, ScatterTooltipContent } from "@/components/morpho/ChartTooltips";
import { MorphoVault } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";

// ============================================================
// Query & Fetcher
// ============================================================

const VAULTS_QUERY = `
query TopVaults($first: Int!, $chains: [Int!]!) {
  vaults(
    first: $first
    orderBy: TotalAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chains, listed: true }
  ) {
    items {
      address symbol name
      chain { id network }
      asset { symbol priceUsd }
      state {
        totalAssetsUsd fee apy netApy
        allocation { market { uniqueKey loanAsset { symbol } collateralAsset { symbol } } supplyAssetsUsd }
      }
      metadata { description }
    }
  }
}
`;

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 8453: "Base" };

function sf(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

async function fetchVaultsClient(): Promise<MorphoVault[]> {
  const res = await fetch("/api/morpho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: VAULTS_QUERY, variables: { first: 50, chains: [1, 8453] } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL error");

  const items = json.data?.vaults?.items || [];
  const results: MorphoVault[] = [];
  for (const v of items) {
    const state = v.state || {};
    const chain = v.chain || {};
    const asset = v.asset || {};
    const meta = v.metadata || {};
    const apy = sf(state.apy);
    const netApy = sf(state.netApy);
    if (apy > 1.0 || netApy > 1.0) continue;
    results.push({
      address: v.address || "", name: v.name || "", symbol: v.symbol || "",
      chainId: chain.id, chain: CHAIN_NAMES[chain.id] || chain.network || "?",
      underlyingAsset: asset.symbol || "?", totalAssetsUsd: sf(state.totalAssetsUsd),
      apy, netApy, fee: sf(state.fee),
      description: (meta.description || "").slice(0, 200),
      numMarkets: (state.allocation || []).length,
    });
  }
  return results;
}

type ChainTab = "all" | "ethereum" | "base";

// ============================================================
// Component
// ============================================================

export default function MorphoPage() {
  const [chainFilter, setChainFilter] = useState<ChainTab>("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: vaults, error, isLoading, mutate } = useSWR(
    "morpho-vaults", fetchVaultsClient,
    { revalidateOnFocus: false, refreshInterval: autoRefresh ? 300_000 : 0 }
  );

  const uniqueAssets = useMemo(() => {
    const symbols = new Set<string>();
    for (const v of vaults || []) {
      if (v.underlyingAsset && v.underlyingAsset !== "?") symbols.add(v.underlyingAsset);
    }
    return Array.from(symbols).sort();
  }, [vaults]);

  const filtered = (vaults || []).filter((v) => {
    if (chainFilter === "ethereum" && v.chainId !== 1) return false;
    if (chainFilter === "base" && v.chainId !== 8453) return false;
    if (assetFilter !== "all" && v.underlyingAsset !== assetFilter) return false;
    return true;
  });

  const totalTvl = filtered.reduce((s, v) => s + v.totalAssetsUsd, 0);
  const avgApy = filtered.length ? filtered.reduce((s, v) => s + v.netApy, 0) / filtered.length : 0;
  const topApy = filtered.reduce((max, v) => Math.max(max, v.netApy), 0);

  const hotThreshold = chainFilter === "base" ? 0.03 : 0.08;
  const hotLabel = chainFilter === "base" ? "3%" : "8%";
  const hotVaults = filtered.filter((v) => v.netApy > hotThreshold).sort((a, b) => b.netApy - a.netApy);

  const vaultUrl = (v: MorphoVault) =>
    `https://app.morpho.org/vault?vault=${v.address}&network=${v.chainId === 8453 ? "base" : "mainnet"}`;

  const barData = useMemo(() => [...filtered]
    .sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd).slice(0, 10).reverse()
    .map((v) => ({
      name: v.name.length > 30 ? v.name.slice(0, 28) + "…" : v.name,
      tvl: v.totalAssetsUsd, chain: v.chain,
      color: v.chainId === 1 ? "#10b981" : "#3b82f6",
    })), [filtered]);

  const scatterData = useMemo(() => filtered
    .filter((v) => v.totalAssetsUsd > 0 && v.netApy > 0)
    .map((v) => ({
      name: v.name, tvl: v.totalAssetsUsd,
      apy: +(v.netApy * 100).toFixed(2), chain: v.chain,
      chainId: v.chainId, markets: v.numMarkets,
      size: Math.max(40, Math.min(400, v.numMarkets * 30)),
    })), [filtered]);

  const medianTvl = useMemo(() => {
    const tvls = scatterData.map((d) => d.tvl).sort((a, b) => a - b);
    return tvls.length ? tvls[Math.floor(tvls.length / 2)] : 0;
  }, [scatterData]);

  const medianApy = useMemo(() => {
    const apys = scatterData.map((d) => d.apy).sort((a, b) => a - b);
    return apys.length ? apys[Math.floor(apys.length / 2)] : 0;
  }, [scatterData]);

  const columns = [
    { key: "name", label: "Vault", width: "28%", minWidth: "180px",
      render: (row: Record<string, unknown>) => {
        const v = row as unknown as MorphoVault;
        return (<div><a href={vaultUrl(v)} target="_blank" rel="noopener noreferrer"
          className="text-gray-200 hover:text-emerald-400 font-medium" onClick={(e) => e.stopPropagation()}>{v.name}</a>
          {v.curator && <span className="ml-2 text-xs text-gray-600">{v.curator}</span>}</div>);
      },
    },
    { key: "chain", label: "Chain", width: "10%", minWidth: "90px",
      render: (row: Record<string, unknown>) => <ChainBadge chain={(row as unknown as MorphoVault).chain} /> },
    { key: "underlyingAsset", label: "Asset", width: "10%", minWidth: "70px",
      render: (row: Record<string, unknown>) => <span className="text-gray-300">{(row as unknown as MorphoVault).underlyingAsset}</span> },
    { key: "totalAssetsUsd", label: "TVL", align: "right" as const, width: "14%", minWidth: "100px",
      render: (row: Record<string, unknown>) => <span className="font-mono text-gray-200">{formatUsd((row as unknown as MorphoVault).totalAssetsUsd)}</span> },
    { key: "netApy", label: "Net APY", align: "right" as const, width: "12%", minWidth: "80px",
      render: (row: Record<string, unknown>) => {
        const v = row as unknown as MorphoVault;
        const pct = v.netApy * 100;
        const green = Math.min(255, Math.floor(pct * 20));
        return <span className="font-mono" style={{ color: `rgb(${255 - green}, ${100 + green}, 100)` }}>{formatPct(v.netApy)}</span>;
      },
    },
    { key: "apy", label: "Gross APY", align: "right" as const, width: "12%", minWidth: "80px",
      render: (row: Record<string, unknown>) => <span className="text-gray-400 font-mono">{formatPct((row as unknown as MorphoVault).apy)}</span> },
    { key: "fee", label: "Fee", align: "right" as const, width: "8%", minWidth: "60px",
      render: (row: Record<string, unknown>) => <span className="text-gray-500 font-mono">{formatPct((row as unknown as MorphoVault).fee, 0)}</span> },
    { key: "numMarkets", label: "Markets", align: "right" as const, width: "8%", minWidth: "60px",
      render: (row: Record<string, unknown>) => <span className="font-mono text-gray-300">{(row as unknown as MorphoVault).numMarkets}</span> },
  ];

  return (
    <div className="pt-8 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">📊 Morpho Markets</h1>
          <p className="text-sm text-gray-500 mt-1">Live vault data from Morpho — Ethereum & Base</p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)}
              className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500" />
            Auto-refresh
          </label>
          <button onClick={() => mutate()} className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total TVL" value={formatUsd(totalTvl)} icon="💰" />
        <MetricCard label="Avg Net APY" value={formatPct(avgApy)} icon="📈" />
        <MetricCard label="🔥 Top APY" value={formatPct(topApy)} icon="🔥" />
        <MetricCard label="Vaults Tracked" value={String(filtered.length)} icon="🏛" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1 w-fit">
          {(["all", "ethereum", "base"] as ChainTab[]).map((tab) => (
            <button key={tab} onClick={() => setChainFilter(tab)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${chainFilter === tab ? "bg-gray-700 text-gray-100 font-medium" : "text-gray-500 hover:text-gray-300"}`}>
              {tab === "all" ? "All Chains" : tab === "ethereum" ? "⟠ Ethereum" : "🔵 Base"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Asset:</label>
          <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-emerald-500/50">
            <option value="all">All Assets ({uniqueAssets.length})</option>
            {uniqueAssets.map((asset) => <option key={asset} value={asset}>{asset}</option>)}
          </select>
        </div>
      </div>

      {/* Charts */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="lg:w-1/2 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">📊 Top 10 Vaults by TVL</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickFormatter={(v) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`} />
                <YAxis type="category" dataKey="name" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 10 }} width={140} />
                <Tooltip content={<VaultBarTooltip />} />
                <Bar dataKey="tvl" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /><span>Ethereum</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /><span>Base</span></div>
            </div>
          </div>

          <div className="lg:w-1/2 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">🎯 TVL vs APY — Sweet Spot Finder</h2>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" dataKey="tvl" name="TVL" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }}
                  scale="log" domain={["auto", "auto"]}
                  tickFormatter={(v) => v >= 1e9 ? `$${(v / 1e9).toFixed(0)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`} />
                <YAxis type="number" dataKey="apy" name="Net APY" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
                <ZAxis type="number" dataKey="size" range={[40, 400]} />
                <Tooltip content={<ScatterTooltipContent />} />
                {medianTvl > 0 && <ReferenceLine x={medianTvl} stroke="#4b5563" strokeDasharray="3 3" />}
                {medianApy > 0 && <ReferenceLine y={medianApy} stroke="#4b5563" strokeDasharray="3 3"><Label value="🎯 Sweet Spot →" position="insideTopRight" fill="#6b7280" fontSize={10} /></ReferenceLine>}
                <Scatter data={scatterData.filter((d) => d.chainId === 1)} name="Ethereum" fill="#10b981">
                  {scatterData.filter((d) => d.chainId === 1).map((_, i) => <Cell key={i} fill="#10b981" fillOpacity={0.7} />)}
                </Scatter>
                <Scatter data={scatterData.filter((d) => d.chainId === 8453)} name="Base" fill="#3b82f6">
                  {scatterData.filter((d) => d.chainId === 8453).map((_, i) => <Cell key={i} fill="#3b82f6" fillOpacity={0.7} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span>Ethereum</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /><span>Base</span></div>
              <span className="text-gray-600">Dot size = # markets</span>
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">❌ {error.message}</div>}
      {isLoading && <div className="text-center py-12 text-gray-500">Loading vaults from Morpho...</div>}

      {hotVaults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4">🔥 Top Opportunities (&gt;{hotLabel} APY)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotVaults.slice(0, 6).map((v) => (
              <HotVaultCard key={v.address} vault={v} vaultUrl={vaultUrl(v)} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400">All Vaults ({filtered.length})</h2>
        </div>
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Parameters<typeof DataTable>[0]["columns"]}
          defaultSort="totalAssetsUsd"
          expandedContent={(row) => {
            const v = row as unknown as MorphoVault;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Address</span><p className="text-gray-300 font-mono text-xs mt-1">{v.address}</p></div>
                <div><span className="text-gray-500">Description</span><p className="text-gray-300 text-xs mt-1">{v.description || "—"}</p></div>
                <div><span className="text-gray-500">Symbol</span><p className="text-gray-300 mt-1">{v.symbol}</p></div>
                <div>
                  <a href={vaultUrl(v)} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors">
                    View on Morpho →
                  </a>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
