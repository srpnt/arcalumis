"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import MetricCard from "@/components/MetricCard";
import ChainBadge from "@/components/ChainBadge";
import DataTable from "@/components/DataTable";
import { MorphoVault } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";

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
          market {
            uniqueKey
            loanAsset { symbol }
            collateralAsset { symbol }
          }
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

async function fetchVaultsClient(): Promise<MorphoVault[]> {
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
      address: v.address || "",
      name: v.name || "",
      symbol: v.symbol || "",
      chainId: chain.id,
      chain: CHAIN_NAMES[chain.id] || chain.network || "?",
      underlyingAsset: asset.symbol || "?",
      totalAssetsUsd: sf(state.totalAssetsUsd),
      apy,
      netApy,
      fee: sf(state.fee),
      description: (meta.description || "").slice(0, 200),
      numMarkets: (state.allocation || []).length,
    });
  }

  return results;
}

type ChainTab = "all" | "ethereum" | "base";

export default function MorphoPage() {
  const [chainFilter, setChainFilter] = useState<ChainTab>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: vaults, error, isLoading, mutate } = useSWR(
    "morpho-vaults",
    fetchVaultsClient,
    {
      revalidateOnFocus: false,
      refreshInterval: autoRefresh ? 300_000 : 0,
    }
  );

  const filtered = (vaults || []).filter((v) => {
    if (chainFilter === "ethereum") return v.chainId === 1;
    if (chainFilter === "base") return v.chainId === 8453;
    return true;
  });

  const totalTvl = filtered.reduce((s, v) => s + v.totalAssetsUsd, 0);
  const avgApy = filtered.length
    ? filtered.reduce((s, v) => s + v.netApy, 0) / filtered.length
    : 0;
  const topApy = filtered.reduce((max, v) => Math.max(max, v.netApy), 0);

  const hotThreshold = chainFilter === "base" ? 0.03 : 0.08;
  const hotLabel = chainFilter === "base" ? "3%" : "8%";
  const hotVaults = filtered
    .filter((v) => v.netApy > hotThreshold)
    .sort((a, b) => b.netApy - a.netApy);

  const vaultUrl = (v: MorphoVault) =>
    `https://app.morpho.org/vault?vault=${v.address}&network=${v.chainId === 8453 ? "base" : "mainnet"}`;

  const columns = [
    {
      key: "name",
      label: "Vault",
      render: (v: MorphoVault) => (
        <div>
          <a
            href={vaultUrl(v)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-200 hover:text-emerald-400 font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {v.name}
          </a>
          {v.curator && (
            <span className="ml-2 text-xs text-gray-600">{v.curator}</span>
          )}
        </div>
      ),
    },
    {
      key: "chain",
      label: "Chain",
      render: (v: MorphoVault) => <ChainBadge chain={v.chain} />,
    },
    { key: "underlyingAsset", label: "Asset" },
    {
      key: "totalAssetsUsd",
      label: "TVL",
      align: "right" as const,
      render: (v: MorphoVault) => formatUsd(v.totalAssetsUsd),
    },
    {
      key: "netApy",
      label: "Net APY",
      align: "right" as const,
      render: (v: MorphoVault) => {
        const pct = v.netApy * 100;
        const green = Math.min(255, Math.floor(pct * 20));
        return (
          <span style={{ color: `rgb(${255 - green}, ${100 + green}, 100)` }}>
            {formatPct(v.netApy)}
          </span>
        );
      },
    },
    {
      key: "apy",
      label: "Gross APY",
      align: "right" as const,
      render: (v: MorphoVault) => (
        <span className="text-gray-400">{formatPct(v.apy)}</span>
      ),
    },
    {
      key: "fee",
      label: "Fee",
      align: "right" as const,
      render: (v: MorphoVault) => (
        <span className="text-gray-500">{formatPct(v.fee, 0)}</span>
      ),
    },
    {
      key: "numMarkets",
      label: "Markets",
      align: "right" as const,
    },
  ];

  return (
    <div className="pt-8 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">📊 Morpho Markets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live vault data from Morpho — Ethereum & Base
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
              className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total TVL" value={formatUsd(totalTvl)} icon="💰" />
        <MetricCard label="Avg Net APY" value={formatPct(avgApy)} icon="📈" />
        <MetricCard
          label="🔥 Top APY"
          value={formatPct(topApy)}
          icon="🔥"
        />
        <MetricCard
          label="Vaults Tracked"
          value={String(filtered.length)}
          icon="🏛"
        />
      </div>

      {/* Chain Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {(["all", "ethereum", "base"] as ChainTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setChainFilter(tab)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              chainFilter === tab
                ? "bg-gray-700 text-gray-100 font-medium"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "all" ? "All Chains" : tab === "ethereum" ? "⟠ Ethereum" : "🔵 Base"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error.message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading vaults from Morpho...
        </div>
      )}

      {/* Top Opportunities */}
      {hotVaults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4">
            🔥 Top Opportunities (&gt;{hotLabel} APY)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotVaults.slice(0, 6).map((v) => (
              <a
                key={v.address}
                href={vaultUrl(v)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/15 rounded-xl p-4 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-200 text-sm">
                      {v.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <ChainBadge chain={v.chain} />
                      <span className="text-xs text-gray-500">
                        {v.underlyingAsset}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">
                      {formatPct(v.netApy)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatUsd(v.totalAssetsUsd)} TVL
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Full Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400">
            All Vaults ({filtered.length})
          </h2>
        </div>
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Parameters<typeof DataTable>[0]["columns"]}
          defaultSort="totalAssetsUsd"
          expandedContent={(row) => {
            const v = row as unknown as MorphoVault;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Address</span>
                  <p className="text-gray-300 font-mono text-xs mt-1">
                    {v.address}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Description</span>
                  <p className="text-gray-300 text-xs mt-1">
                    {v.description || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Symbol</span>
                  <p className="text-gray-300 mt-1">{v.symbol}</p>
                </div>
                <div>
                  <a
                    href={vaultUrl(v)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
                  >
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
