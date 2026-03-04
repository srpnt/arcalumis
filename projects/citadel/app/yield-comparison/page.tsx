"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import ROICalculator from "@/components/yield-comparison/ROICalculator";
import ButterflyTooltip from "@/components/yield-comparison/ButterflyTooltip";
import { MorphoVault, ChainRate } from "@/lib/types";
import { formatPct, formatUsd } from "@/lib/format";

const VAULTS_QUERY = `
query TopVaults($first: Int!, $chains: [Int!]!) {
  vaults(
    first: $first
    orderBy: TotalAssetsUsd
    orderDirection: Desc
    where: { chainId_in: $chains, listed: true }
  ) {
    items {
      address
      symbol
      name
      chain { id network }
      asset { symbol priceUsd }
      state {
        totalAssetsUsd
        fee
        apy
        netApy
        allocation {
          market { uniqueKey }
          supplyAssetsUsd
        }
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

async function fetchVaultsForDiff(): Promise<MorphoVault[]> {
  const res = await fetch("/api/morpho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: VAULTS_QUERY,
      variables: { first: 50, chains: [1, 8453] },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL error");

  const items = json.data?.vaults?.items || [];
  return items
    .map((v: Record<string, unknown>) => {
      const state = (v.state || {}) as Record<string, unknown>;
      const chain = (v.chain || {}) as Record<string, unknown>;
      const asset = (v.asset || {}) as Record<string, unknown>;
      const apy = sf(state.apy);
      const netApy = sf(state.netApy);
      if (apy > 1.0 || netApy > 1.0) return null;
      return {
        address: v.address || "",
        name: v.name || "",
        symbol: v.symbol || "",
        chainId: chain.id as number,
        chain: CHAIN_NAMES[chain.id as number] || (chain.network as string) || "?",
        underlyingAsset: (asset.symbol as string) || "?",
        totalAssetsUsd: sf(state.totalAssetsUsd),
        apy,
        netApy,
        fee: sf(state.fee),
        description: "",
        numMarkets: ((state.allocation || []) as unknown[]).length,
      };
    })
    .filter(Boolean) as MorphoVault[];
}

function computeDiffs(vaults: MorphoVault[], minTvl: number): ChainRate[] {
  const ethVaults = vaults.filter(
    (v) => v.chainId === 1 && v.totalAssetsUsd >= minTvl
  );
  const baseVaults = vaults.filter(
    (v) => v.chainId === 8453 && v.totalAssetsUsd >= minTvl
  );

  const ethByAsset = new Map<string, { apys: number[]; tvl: number; count: number }>();
  for (const v of ethVaults) {
    const existing = ethByAsset.get(v.underlyingAsset) || { apys: [], tvl: 0, count: 0 };
    existing.apys.push(v.netApy);
    existing.tvl += v.totalAssetsUsd;
    existing.count++;
    ethByAsset.set(v.underlyingAsset, existing);
  }

  const baseByAsset = new Map<string, { apys: number[]; tvl: number; count: number }>();
  for (const v of baseVaults) {
    const existing = baseByAsset.get(v.underlyingAsset) || { apys: [], tvl: 0, count: 0 };
    existing.apys.push(v.netApy);
    existing.tvl += v.totalAssetsUsd;
    existing.count++;
    baseByAsset.set(v.underlyingAsset, existing);
  }

  const diffs: ChainRate[] = [];

  for (const [asset, ethData] of ethByAsset) {
    const baseData = baseByAsset.get(asset);
    if (!baseData) continue;

    const ethBest = Math.max(...ethData.apys);
    const baseBest = Math.max(...baseData.apys);
    const ethAvg = ethData.apys.reduce((s, a) => s + a, 0) / ethData.apys.length;
    const baseAvg = baseData.apys.reduce((s, a) => s + a, 0) / baseData.apys.length;
    const spread = ethBest - baseBest;

    diffs.push({
      asset,
      ethBestApy: ethBest,
      ethAvgApy: ethAvg,
      ethTvl: ethData.tvl,
      ethCount: ethData.count,
      baseBestApy: baseBest,
      baseAvgApy: baseAvg,
      baseTvl: baseData.tvl,
      baseCount: baseData.count,
      spread,
      absSpread: Math.abs(spread),
    });
  }

  return diffs.sort((a, b) => b.absSpread - a.absSpread);
}

export default function YieldComparisonPage() {
  const [minTvl, setMinTvl] = useState(1_000_000);
  const [roiCapital, setRoiCapital] = useState(100000);
  const [roiAsset, setRoiAsset] = useState("");

  const { data: vaults, error, isLoading } = useSWR(
    "diff-vaults",
    fetchVaultsForDiff,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  );

  const diffs = useMemo(
    () => (vaults ? computeDiffs(vaults, minTvl) : []),
    [vaults, minTvl]
  );

  const opportunities = diffs.filter((d) => d.absSpread > 0.01);
  const maxSpread = diffs.length ? diffs[0].absSpread : 0;

  // --- Butterfly chart data ---
  const butterflyData = useMemo(() => {
    return [...diffs].map((d) => ({
      asset: d.asset,
      ethRate: -(d.ethBestApy * 100),      // negative = extends left
      baseRate: +(d.baseBestApy * 100),     // positive = extends right
      ethDisplay: +(d.ethBestApy * 100).toFixed(2),
      baseDisplay: +(d.baseBestApy * 100).toFixed(2),
      spread: d.absSpread,
      highlight: d.absSpread > 0.02,
    }));
  }, [diffs]);

  // Max domain for symmetric axis
  const maxRate = useMemo(() => {
    let m = 0;
    for (const d of butterflyData) {
      m = Math.max(m, Math.abs(d.ethRate), d.baseRate);
    }
    return Math.ceil(m + 1);
  }, [butterflyData]);

  return (
    <div className="pt-8 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            🔀 Cross-Chain Yield Comparison
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ethereum vs Base rate comparison on Morpho
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <label className="text-xs text-gray-500">Min TVL:</label>
          <select
            value={minTvl}
            onChange={(e) => setMinTvl(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <option value={0}>All</option>
            <option value={100_000}>$100K</option>
            <option value={1_000_000}>$1M</option>
            <option value={10_000_000}>$10M</option>
            <option value={50_000_000}>$50M</option>
          </select>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Cross-Chain Pairs" value={String(diffs.length)} icon="🔗" />
        <MetricCard label="Arb Opportunities (>1%)" value={String(opportunities.length)} icon="🎯" />
        <MetricCard label="Max Spread" value={formatPct(maxSpread)} icon="📈" />
      </div>

      {/* ROI Calculator */}
      {diffs.length > 0 && (
        <ROICalculator
          diffs={diffs}
          capital={roiCapital}
          setCapital={setRoiCapital}
          selectedAsset={roiAsset}
          setSelectedAsset={setRoiAsset}
        />
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error.message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading cross-chain data...
        </div>
      )}

      {/* Top Opportunities */}
      {opportunities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4">
            🎯 Top Arbitrage Opportunities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.slice(0, 6).map((d) => {
              const direction = d.spread > 0 ? "ETH → Base" : "Base → ETH";
              const higher = d.spread > 0 ? "Ethereum" : "Base";
              return (
                <div
                  key={d.asset}
                  className="bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/15 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-200">{d.asset}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {direction} • Higher on {higher}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ETH: {formatPct(d.ethBestApy)} • Base: {formatPct(d.baseBestApy)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-emerald-400">
                        {formatPct(d.absSpread)}
                      </p>
                      <p className="text-xs text-gray-500">spread</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Butterfly Chart */}
      {butterflyData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-1">
            🦋 Rate Butterfly — Ethereum (left) vs Base (right)
          </h2>
          <p className="text-xs text-gray-600 mb-4">
            Diverging bars show best APY per chain. Rows with &gt;2% spread highlighted.
          </p>
          <ResponsiveContainer width="100%" height={Math.max(300, butterflyData.length * 40)}>
            <BarChart
              data={butterflyData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              stackOffset="sign"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                stroke="#4b5563"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                domain={[-maxRate, maxRate]}
                tickFormatter={(v) => `${Math.abs(v).toFixed(1)}%`}
              />
              <YAxis
                type="category"
                dataKey="asset"
                stroke="#4b5563"
                tick={{ fill: "#d1d5db", fontSize: 12, fontWeight: 500 }}
                width={80}
              />
              <Tooltip content={<ButterflyTooltip />} />
              <ReferenceLine x={0} stroke="#6b7280" strokeWidth={2} />
              <Bar dataKey="ethRate" name="Ethereum" stackId="stack" radius={[4, 0, 0, 4]}>
                {butterflyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.highlight ? "#34d399" : "#10b981"}
                    fillOpacity={entry.highlight ? 1 : 0.7}
                  />
                ))}
              </Bar>
              <Bar dataKey="baseRate" name="Base" stackId="stack" radius={[0, 4, 4, 0]}>
                {butterflyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.highlight ? "#60a5fa" : "#3b82f6"}
                    fillOpacity={entry.highlight ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>← Ethereum</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              <span>Base →</span>
            </div>
            <span className="text-gray-600">Brighter = spread &gt;2%</span>
          </div>
        </div>
      )}

      {/* Spread Details Table */}
      {diffs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400">
              Spread Details
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[16%]">
                    Asset
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[14%]">
                    ETH Best APY
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[14%]">
                    Base Best APY
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[14%]">
                    Spread
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[16%]">
                    ETH TVL
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-[16%]">
                    Base TVL
                  </th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr
                    key={d.asset}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                      d.absSpread > 0.02 ? "bg-emerald-500/[0.03]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {d.asset}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                      {formatPct(d.ethBestApy)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-mono">
                      {formatPct(d.baseBestApy)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium font-mono ${
                        d.absSpread > 0.01
                          ? "text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {d.spread > 0 ? "+" : ""}
                      {formatPct(d.spread)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUsd(d.ethTvl)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {formatUsd(d.baseTvl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
