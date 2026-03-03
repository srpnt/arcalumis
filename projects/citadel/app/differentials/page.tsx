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
} from "recharts";
import MetricCard from "@/components/MetricCard";
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

  const ethByAsset = new Map<
    string,
    { apys: number[]; tvl: number; count: number }
  >();
  for (const v of ethVaults) {
    const existing = ethByAsset.get(v.underlyingAsset) || {
      apys: [],
      tvl: 0,
      count: 0,
    };
    existing.apys.push(v.netApy);
    existing.tvl += v.totalAssetsUsd;
    existing.count++;
    ethByAsset.set(v.underlyingAsset, existing);
  }

  const baseByAsset = new Map<
    string,
    { apys: number[]; tvl: number; count: number }
  >();
  for (const v of baseVaults) {
    const existing = baseByAsset.get(v.underlyingAsset) || {
      apys: [],
      tvl: 0,
      count: 0,
    };
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
    const baseAvg =
      baseData.apys.reduce((s, a) => s + a, 0) / baseData.apys.length;
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

export default function DifferentialsPage() {
  const [minTvl, setMinTvl] = useState(1_000_000);

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

  const chartData = [...diffs].reverse().map((d) => ({
    asset: d.asset,
    Ethereum: +(d.ethBestApy * 100).toFixed(2),
    Base: +(d.baseBestApy * 100).toFixed(2),
  }));

  return (
    <div className="pt-8 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            🔀 Cross-Chain Differentials
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
        <MetricCard
          label="Cross-Chain Pairs"
          value={String(diffs.length)}
          icon="🔗"
        />
        <MetricCard
          label="Arb Opportunities (>1%)"
          value={String(opportunities.length)}
          icon="🎯"
        />
        <MetricCard
          label="Max Spread"
          value={formatPct(maxSpread)}
          icon="📈"
        />
      </div>

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
                        ETH: {formatPct(d.ethBestApy)} • Base:{" "}
                        {formatPct(d.baseBestApy)}
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

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            📊 Rate Comparison by Asset (Best APY %)
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="#4b5563"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="asset"
                stroke="#4b5563"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#e5e7eb",
                }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend />
              <Bar dataKey="Ethereum" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Base" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Asset
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    ETH Best APY
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Base Best APY
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Spread
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    ETH TVL
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Base TVL
                  </th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => (
                  <tr
                    key={d.asset}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {d.asset}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-400">
                      {formatPct(d.ethBestApy)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400">
                      {formatPct(d.baseBestApy)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        d.absSpread > 0.01
                          ? "text-emerald-400"
                          : "text-gray-500"
                      }`}
                    >
                      {d.spread > 0 ? "+" : ""}
                      {formatPct(d.spread)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {formatUsd(d.ethTvl)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
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
