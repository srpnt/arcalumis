"use client";

import { useState } from "react";
import useSWR from "swr";
import MetricCard from "@/components/MetricCard";
import ChainBadge from "@/components/ChainBadge";
import DataTable from "@/components/DataTable";
import RiskTierBadge from "@/components/RiskTierBadge";
import { formatUsd, formatPct, formatAddress } from "@/lib/format";

// --- Types matching the API response ---

interface ExposureMarket {
  uniqueKey: string;
  loanAsset: string;
  loanAssetAddress: string;
  lltv: number;
  supplyUsd: number;
  borrowUsd: number;
  utilization: number;
  oracleAddress: string;
  chainId: number;
  chain: string;
}

interface CollateralAsset {
  symbol: string;
  address: string;
  priceUsd: number;
  tier: number;
  tierLabel: string;
  tierEmoji: string;
  totalExposureUsd: number;
  totalBorrowUsd: number;
  marketCount: number;
  chains: string[];
  chainIds: number[];
  markets: ExposureMarket[];
}

interface ExposureData {
  timestamp: number;
  totalAssetsTracked: number;
  totalExposureUsd: number;
  tier4ExposureUsd: number;
  highestConcentration: { symbol: string; pct: number };
  assets: CollateralAsset[];
}

// --- Fetcher ---

async function fetchExposure(): Promise<ExposureData> {
  const res = await fetch("/api/exposure");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// --- Tier filter type ---

type TierFilter = "all" | 1 | 2 | 3 | 4;

// --- Row background by tier ---

function tierRowClass(tier: number): string {
  if (tier === 4) return "bg-red-500/[0.03]";
  if (tier === 3) return "bg-amber-500/[0.03]";
  return "";
}

// --- Market URL builder ---

function morphoMarketUrl(uniqueKey: string, chainId: number): string {
  const network = chainId === 8453 ? "base" : "mainnet";
  return `https://app.morpho.org/market?id=${uniqueKey}&network=${network}`;
}

// --- Page Component ---

export default function ExposurePage() {
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const { data, error, isLoading, mutate } = useSWR(
    "collateral-exposure",
    fetchExposure,
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  const assets = data?.assets || [];
  const filtered =
    tierFilter === "all" ? assets : assets.filter((a) => a.tier === tierFilter);

  // Build table-friendly rows
  const rows = filtered.map((a) => ({
    ...a,
    // DataTable needs these as top-level for sorting
    uniqueId: a.symbol,
  }));

  const columns = [
    {
      key: "symbol",
      label: "Asset",
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-200">{a.symbol}</span>
            {a.priceUsd > 0 && (
              <span className="text-xs text-gray-500">
                ${a.priceUsd < 0.01 ? a.priceUsd.toExponential(2) : a.priceUsd.toFixed(2)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "tier",
      label: "Risk Tier",
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        return (
          <RiskTierBadge tier={a.tier} label={a.tierLabel} emoji={a.tierEmoji} />
        );
      },
    },
    {
      key: "totalExposureUsd",
      label: "Total Exposure",
      align: "right" as const,
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        return (
          <span className={a.tier === 4 ? "text-red-400 font-medium" : "text-gray-200"}>
            {formatUsd(a.totalExposureUsd)}
          </span>
        );
      },
    },
    {
      key: "marketCount",
      label: "Markets",
      align: "right" as const,
    },
    {
      key: "chains",
      label: "Chains",
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        return (
          <div className="flex gap-1 flex-wrap">
            {a.chains.map((c) => (
              <ChainBadge key={c} chain={c} />
            ))}
          </div>
        );
      },
      sortable: false,
    },
    {
      key: "priceUsd",
      label: "Price",
      align: "right" as const,
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        if (!a.priceUsd || a.priceUsd === 0) return <span className="text-gray-600">—</span>;
        return (
          <span className="text-gray-400 font-mono text-xs">
            ${a.priceUsd < 0.01 ? a.priceUsd.toExponential(2) : a.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
  ];

  // Expanded row: market detail
  const expandedContent = (row: Record<string, unknown>) => {
    const a = row as unknown as CollateralAsset;
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Markets using {a.symbol} as collateral ({a.markets.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/50">
                <th className="text-left px-3 py-2">Market ID</th>
                <th className="text-left px-3 py-2">Loan Asset</th>
                <th className="text-left px-3 py-2">Chain</th>
                <th className="text-right px-3 py-2">LLTV</th>
                <th className="text-right px-3 py-2">Supply USD</th>
                <th className="text-right px-3 py-2">Utilization</th>
                <th className="text-left px-3 py-2">Oracle</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {a.markets
                .sort((x, y) => y.supplyUsd - x.supplyUsd)
                .map((m) => (
                  <tr
                    key={m.uniqueKey}
                    className="border-b border-gray-800/30 hover:bg-gray-800/20"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">
                      {m.uniqueKey.slice(0, 10)}…
                    </td>
                    <td className="px-3 py-2 text-gray-300">{m.loanAsset}</td>
                    <td className="px-3 py-2">
                      <ChainBadge chain={m.chain} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">
                      {(m.lltv * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-200">
                      {formatUsd(m.supplyUsd)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {formatPct(m.utilization)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {m.oracleAddress ? formatAddress(m.oracleAddress) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={morphoMarketUrl(m.uniqueKey, m.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            🛡 Collateral Exposure
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Every collateral asset across Morpho — know your exposure before it matters
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="mt-4 sm:mt-0 px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Collateral Assets Tracked"
          value={String(data?.totalAssetsTracked || 0)}
          icon="🛡"
        />
        <MetricCard
          label="Tier 4 (Exotic) Exposure"
          value={formatUsd(data?.tier4ExposureUsd || 0)}
          subtitle="⚠️ Danger zone"
          icon="🔴"
        />
        <MetricCard
          label="Highest Concentration"
          value={
            data?.highestConcentration
              ? `${data.highestConcentration.symbol} — ${(data.highestConcentration.pct * 100).toFixed(1)}%`
              : "—"
          }
          subtitle="Single asset as % of total"
          icon="📊"
        />
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit flex-wrap">
        {(
          [
            { val: "all" as TierFilter, label: "All Tiers" },
            { val: 1 as TierFilter, label: "🟢 Blue Chip" },
            { val: 2 as TierFilter, label: "🔵 Established" },
            { val: 3 as TierFilter, label: "🟡 Emerging" },
            { val: 4 as TierFilter, label: "🔴 Exotic" },
          ] as const
        ).map((tab) => (
          <button
            key={String(tab.val)}
            onClick={() => setTierFilter(tab.val)}
            className={`px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
              tierFilter === tab.val
                ? "bg-gray-700 text-gray-100 font-medium"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading collateral exposure data...
        </div>
      )}

      {/* Data Table */}
      {!isLoading && rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400">
              Collateral Assets ({rows.length})
            </h2>
            {tierFilter === 4 && (
              <span className="text-xs text-red-400 animate-pulse">
                ⚠ Showing exotic / high-risk assets only
              </span>
            )}
          </div>
          <DataTable
            data={rows as unknown as Record<string, unknown>[]}
            columns={columns}
            defaultSort="totalExposureUsd"
            expandedContent={expandedContent}
          />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && rows.length === 0 && data && (
        <div className="text-center py-12 text-gray-500">
          No assets found for this filter.
        </div>
      )}
    </div>
  );
}
