"use client";

import { useState, useMemo, Fragment } from "react";
import type { ArbitrageOpportunity, AssetChainData } from "@/lib/types";
import { getMorphoMarketUrl } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";
import SpreadBadge from "./SpreadBadge";
import AssetChainBreakdown from "./AssetChainBreakdown";

type SortKey =
  | "spread"
  | "asset"
  | "supplyApy"
  | "borrowApy"
  | "supplyTvl"
  | "borrowTvl";

/** Clickable chain name that links to Morpho market page */
function MorphoLink({
  chainName,
  marketId,
  chainId,
}: {
  chainName: string;
  marketId?: string;
  chainId: number;
}) {
  const url = marketId ? getMorphoMarketUrl(marketId, chainId) : null;
  if (!url) return <>{chainName}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="hover:text-gray-200 underline decoration-gray-600 underline-offset-2 hover:decoration-gray-400 transition-colors"
    >
      {chainName}
      <span className="ml-0.5 text-[9px] opacity-60">↗</span>
    </a>
  );
}

interface OpportunityTableProps {
  opportunities: ArbitrageOpportunity[];
  assetBreakdowns: Record<string, AssetChainData[]>;
}

export default function OpportunityTable({
  opportunities,
  assetBreakdowns,
}: OpportunityTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("spread");
  const [sortAsc, setSortAsc] = useState(false);
  const [minSpread, setMinSpread] = useState(0.5);
  const [minTvl, setMinTvl] = useState(0);
  const [assetFilter, setAssetFilter] = useState("all");
  const [hideNegBorrow, setHideNegBorrow] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  // Available assets for filter
  const allAssets = useMemo(() => {
    const s = new Set(opportunities.map((o) => o.asset));
    return [...s].sort();
  }, [opportunities]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = opportunities.filter(
      (o) =>
        o.grossSpread * 100 >= minSpread &&
        o.supplyTvl >= minTvl &&
        o.borrowTvl >= minTvl &&
        (assetFilter === "all" || o.asset === assetFilter) &&
        (!hideNegBorrow || o.effectiveBorrowApy >= 0)
    );

    list.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "spread":
          diff = a.grossSpread - b.grossSpread;
          break;
        case "asset":
          diff = a.asset.localeCompare(b.asset);
          break;
        case "supplyApy":
          diff = a.supplyApy - b.supplyApy;
          break;
        case "borrowApy":
          diff = a.effectiveBorrowApy - b.effectiveBorrowApy;
          break;
        case "supplyTvl":
          diff = a.supplyTvl - b.supplyTvl;
          break;
        case "borrowTvl":
          diff = a.borrowTvl - b.borrowTvl;
          break;
      }
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [opportunities, minSpread, minTvl, assetFilter, hideNegBorrow, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortAsc ? "↑" : "↓";
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center gap-4">
        <h2 className="text-sm font-semibold text-gray-400 mr-auto">
          ⚡ Arbitrage Opportunities
        </h2>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Min Spread:</label>
          <select
            value={minSpread}
            onChange={(e) => setMinSpread(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300"
          >
            <option value={0}>All</option>
            <option value={0.5}>0.5%</option>
            <option value={1}>1%</option>
            <option value={2}>2%</option>
            <option value={5}>5%</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Min TVL:</label>
          <select
            value={minTvl}
            onChange={(e) => setMinTvl(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300"
          >
            <option value={0}>All</option>
            <option value={100_000}>$100K</option>
            <option value={1_000_000}>$1M</option>
            <option value={10_000_000}>$10M</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Asset:</label>
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300"
          >
            <option value="all">All Assets</option>
            {allAssets.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideNegBorrow}
            onChange={(e) => setHideNegBorrow(e.target.checked)}
            className="accent-emerald-500 w-3.5 h-3.5 rounded"
          />
          <span className="text-xs text-gray-500">
            Hide negative borrow
          </span>
        </label>

        <span className="text-xs text-gray-600">
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-10">
                #
              </th>
              <th
                className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("asset")}
              >
                Asset {sortIcon("asset")}
              </th>
              <th
                className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("spread")}
              >
                Spread {sortIcon("spread")}
              </th>
              <th
                className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("supplyApy")}
              >
                Supply {sortIcon("supplyApy")}
              </th>
              <th
                className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("borrowApy")}
              >
                Borrow {sortIcon("borrowApy")}
              </th>
              <th
                className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("supplyTvl")}
              >
                Supply TVL {sortIcon("supplyTvl")}
              </th>
              <th
                className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300"
                onClick={() => handleSort("borrowTvl")}
              >
                Borrow TVL {sortIcon("borrowTvl")}
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                Collateral
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                Rewards
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((opp, i) => {
              const isExpanded = expandedAsset === `${opp.asset}-${i}`;
              const breakdown = assetBreakdowns[opp.asset];
              return (
                <Fragment key={`${opp.asset}-${opp.supplyChain}-${opp.borrowChain}-${i}`}>
                  <tr
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${
                      opp.grossSpread > 0.05
                        ? "bg-emerald-500/[0.03]"
                        : ""
                    }`}
                    onClick={() =>
                      setExpandedAsset(isExpanded ? null : `${opp.asset}-${i}`)
                    }
                  >
                    <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-200">
                      <div className="flex items-center gap-1.5">
                        <span>{isExpanded ? "▼" : "▶"}</span>
                        <span>{opp.asset}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <SpreadBadge spread={opp.grossSpread} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-emerald-400 font-mono text-xs">
                        {formatPct(opp.supplyApy)}
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        on{" "}
                        <MorphoLink
                          chainName={opp.supplyChain}
                          marketId={opp.supplyMarketId}
                          chainId={opp.supplyChainId}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="text-blue-400 font-mono text-xs">
                        {formatPct(opp.effectiveBorrowApy)}
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        on{" "}
                        <MorphoLink
                          chainName={opp.borrowChain}
                          marketId={opp.borrowMarketId}
                          chainId={opp.borrowChainId}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400 font-mono text-xs">
                      {formatUsd(opp.supplyTvl)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400 font-mono text-xs">
                      {formatUsd(opp.borrowTvl)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">
                      {opp.supplyCollateral}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {opp.rewardTokens.length > 0 ? (
                        <span className="text-amber-400">
                          🎁 {opp.rewardTokens.join(", ")}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && breakdown && (
                    <tr>
                      <td colSpan={9} className="px-3 py-3 bg-gray-900/80">
                        <AssetChainBreakdown
                          asset={opp.asset}
                          chains={breakdown}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No opportunities match current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


