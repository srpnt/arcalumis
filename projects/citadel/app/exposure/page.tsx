"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import {
  Treemap,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import ChainBadge from "@/components/ChainBadge";
import DataTable from "@/components/DataTable";
import RiskTierBadge from "@/components/RiskTierBadge";
import TreemapContent from "@/components/exposure/TreemapContent";
import { TreemapTooltip, DonutTooltip } from "@/components/exposure/ChartTooltips";
import { formatUsd, formatPct, formatAddress } from "@/lib/format";
import { getMorphoMarketUrl } from "@/lib/chains";

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

// --- Tier colors ---

const TIER_COLORS: Record<number, string> = {
  1: "#10b981", // emerald
  2: "#3b82f6", // blue
  3: "#f59e0b", // amber
  4: "#ef4444", // red
};

const TIER_NAMES: Record<number, string> = {
  1: "Tier 1 — Blue Chip",
  2: "Tier 2 — Established",
  3: "Tier 3 — Emerging",
  4: "Tier 4 — Exotic",
};

// --- Page Component ---

export default function ExposurePage() {
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, error, isLoading, mutate } = useSWR(
    "collateral-exposure",
    fetchExposure,
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  const assets = data?.assets || [];
  const filtered = assets.filter((a) => {
    if (tierFilter !== "all" && a.tier !== tierFilter) return false;
    if (searchQuery.trim() && !a.symbol.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  // Build table-friendly rows
  const rows = filtered.map((a) => ({
    ...a,
    uniqueId: a.symbol,
  }));

  // --- Treemap data: top 25 assets by exposure (respects search + tier filter) ---
  const treemapData = useMemo(() => {
    const sorted = [...filtered]
      .sort((a, b) => b.totalExposureUsd - a.totalExposureUsd)
      .slice(0, 25);
    return sorted.map((a) => ({
      name: a.symbol,
      size: a.totalExposureUsd,
      exposure: formatUsd(a.totalExposureUsd),
      tier: a.tier,
      tierLabel: a.tierLabel,
      fill: TIER_COLORS[a.tier] || TIER_COLORS[4],
    }));
  }, [filtered]);

  // --- Donut data: tier breakdown ---
  const donutData = useMemo(() => {
    const tierSums: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const a of assets) {
      tierSums[a.tier] = (tierSums[a.tier] || 0) + a.totalExposureUsd;
    }
    return [1, 2, 3, 4]
      .filter((t) => tierSums[t] > 0)
      .map((t) => ({
        name: TIER_NAMES[t],
        value: tierSums[t],
        color: TIER_COLORS[t],
      }));
  }, [assets]);

  const totalExposure = data?.totalExposureUsd || 0;

  const columns = [
    {
      key: "symbol",
      label: "Asset",
      width: "18%",
      minWidth: "140px",
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
      width: "16%",
      minWidth: "130px",
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
      width: "18%",
      minWidth: "130px",
      render: (row: Record<string, unknown>) => {
        const a = row as unknown as CollateralAsset;
        return (
          <span className={`font-mono ${a.tier === 4 ? "text-red-400 font-medium" : "text-gray-200"}`}>
            {formatUsd(a.totalExposureUsd)}
          </span>
        );
      },
    },
    {
      key: "marketCount",
      label: "Markets",
      align: "right" as const,
      width: "10%",
      minWidth: "80px",
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-gray-300">{String(row.marketCount ?? "—")}</span>
      ),
    },
    {
      key: "chains",
      label: "Chains",
      width: "18%",
      minWidth: "120px",
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
      width: "20%",
      minWidth: "120px",
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
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/50">
                <th className="text-left px-3 py-2 w-[14%]">Market ID</th>
                <th className="text-left px-3 py-2 w-[12%]">Loan Asset</th>
                <th className="text-left px-3 py-2 w-[12%]">Chain</th>
                <th className="text-right px-3 py-2 w-[10%]">LLTV</th>
                <th className="text-right px-3 py-2 w-[16%]">Supply USD</th>
                <th className="text-right px-3 py-2 w-[12%]">Utilization</th>
                <th className="text-left px-3 py-2 w-[16%]">Oracle</th>
                <th className="px-3 py-2 w-[8%]"></th>
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
                    <td className="px-3 py-2 text-right text-gray-300 font-mono">
                      {(m.lltv * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-200 font-mono">
                      {formatUsd(m.supplyUsd)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 font-mono">
                      {formatPct(m.utilization)}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {m.oracleAddress ? formatAddress(m.oracleAddress) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={getMorphoMarketUrl(m.uniqueKey, m.chainId) || "#"}
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

      {/* Visualization Row: Treemap + Donut */}
      {!isLoading && assets.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* Treemap */}
          <div className="lg:w-2/3 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              🗺 Risk Exposure Map
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={treemapData}
                dataKey="size"
                nameKey="name"
                content={<TreemapContent x={0} y={0} width={0} height={0} name="" exposure="" fill="" />}
              >
                <Tooltip content={<TreemapTooltip />} />
              </Treemap>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              {[1, 2, 3, 4].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: TIER_COLORS[t] }}
                  />
                  <span>{TIER_NAMES[t].split(" — ")[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Donut */}
          <div className="lg:w-1/3 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">
              🍩 Tier Breakdown
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="none"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-gray-400 text-xs">{value}</span>
                  )}
                />
                {/* Center text */}
                <text
                  x="50%"
                  y="42%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#e5e7eb"
                  fontSize={16}
                  fontWeight="bold"
                >
                  {formatUsd(totalExposure)}
                </text>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#6b7280"
                  fontSize={11}
                >
                  Total Exposure
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tier Filter Tabs + Search */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1 flex-wrap">
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

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-48 bg-gray-900 border border-gray-800 rounded-lg pl-4 pr-8 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {filtered.length}/{assets.length}
          </span>
        </div>
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
