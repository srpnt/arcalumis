"use client";

import Link from "next/link";
import useSWR from "swr";
import NodeStatus from "@/components/execution/NodeStatus";
import PortfolioCards from "@/components/execution/PortfolioCards";
import PositionsTable from "@/components/execution/PositionsTable";
import { formatAddress, formatPct } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/chains";

// ============================================================
// Types
// ============================================================

interface NodeStatusData {
  status: string;
  smartAccount?: string;
  chains?: Array<{
    chainId: number;
    ethFormatted?: string;
    tokenBalances?: Array<{
      symbol: string;
      balance: string;
    }>;
  }>;
  uptime?: number;
  [key: string]: unknown;
}

interface Position {
  chainId: number;
  chain?: string;
  marketId: string;
  collateralAsset: string;
  loanAsset: string;
  collateralSymbol?: string;
  loanSymbol?: string;
  supplyShares: string;
  borrowShares: string;
  collateral?: string;
  supplyApy?: number;
  borrowApy?: number;
  tvl?: number;
}

interface PositionsData {
  positions: Position[];
  balances?: Array<{
    chainId: number;
    ethBalance: string;
    tokens?: Array<{
      symbol: string;
      balance: string;
      decimals: number;
    }>;
  }>;
}

interface Opportunity {
  asset: string;
  grossSpread: number;
  supplyChain: string;
  supplyChainId?: number;
  borrowChain: string;
  borrowChainId?: number;
  supplyApy: number;
  borrowApy: number;
  riskScore?: number;
}

interface OpportunitiesData {
  opportunities: Opportunity[];
}

interface MorphoSummary {
  totalVaults: number;
  bestSpread?: number;
  chainsMonitored?: number;
}

// ============================================================
// Fetchers
// ============================================================

const nodeFetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

const apiFetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};

// ============================================================
// Helpers
// ============================================================

function getExplorerUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}

function riskBadge(score?: number) {
  if (score === undefined || score === null) return null;
  if (score >= 8) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Low</span>;
  if (score >= 5) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Med</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">High</span>;
}

// ============================================================
// Page
// ============================================================

export default function CommandCenter() {
  const {
    data: statusData,
    error: statusError,
    isLoading: statusLoading,
  } = useSWR<NodeStatusData>("/api/node/status", nodeFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const {
    data: positionsData,
    isLoading: positionsLoading,
  } = useSWR<PositionsData>("/api/node/positions", nodeFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const {
    data: opportunitiesData,
  } = useSWR<OpportunitiesData>("/api/node/opportunities", nodeFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const { data: arbData } = useSWR("/api/arbitrage", apiFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const nodeOnline = !statusError && !!statusData;
  const smartAccount = statusData?.smartAccount || "";
  const positions = positionsData?.positions || [];
  const opportunities = (opportunitiesData?.opportunities || []).slice(0, 5);

  // Portfolio balances from node status
  const balances = (statusData?.chains || []).map((c) => ({
    chainId: c.chainId,
    ethBalance: c.ethFormatted || "0",
    tokens: (c.tokenBalances || []).map((t) => ({
      symbol: t.symbol,
      balance: t.balance,
      decimals: ["USDC", "USDT", "EURC"].includes(t.symbol) ? 6 : 18,
    })),
  }));

  // Quick stats from arbitrage API
  const totalMarkets = arbData?.totalOpportunities ?? 0;
  const bestSpread = arbData?.bestSpread ?? 0;
  const chainsTracked = arbData?.chainsMonitored ?? 0;

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">
              🏰 The Citadel
            </h1>
            <NodeStatus online={nodeOnline} loading={statusLoading} />
          </div>
          {smartAccount && (
            <a
              href={getExplorerUrl(smartAccount)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
            >
              {formatAddress(smartAccount)}
              <span className="text-[10px]">↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Offline Banner */}
      {!statusLoading && !nodeOnline && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-sm text-red-400">
          <span className="font-medium">Node offline</span> — The execution
          node at localhost:4100 is not responding. Start the node to see live
          data.
        </div>
      )}

      {/* Portfolio Strip */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Portfolio
        </h2>
        <PortfolioCards
          balances={balances}
          loading={nodeOnline && positionsLoading}
        />
      </section>

      {/* Active Positions */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Active Positions
        </h2>
        <PositionsTable
          positions={positions}
          loading={nodeOnline && positionsLoading}
        />
      </section>

      {/* Top Opportunities */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Top Opportunities
          </h2>
          <Link
            href="/arbitrage"
            className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            View all →
          </Link>
        </div>
        {opportunities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {opportunities.map((opp, i) => (
              <div
                key={`${opp.asset}-${opp.supplyChainId}-${opp.borrowChainId}-${i}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">
                    {opp.asset}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    +{((opp.grossSpread || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-gray-500">
                  <span className="text-gray-400">
                    {opp.supplyChainId
                      ? CHAIN_NAMES[opp.supplyChainId] || opp.supplyChain
                      : opp.supplyChain}
                  </span>
                  <span className="mx-1">→</span>
                  <span className="text-gray-400">
                    {opp.borrowChainId
                      ? CHAIN_NAMES[opp.borrowChainId] || opp.borrowChain
                      : opp.borrowChain}
                  </span>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                  <span>Supply {(opp.supplyApy * 100).toFixed(1)}%</span>
                  <span>Borrow {(opp.borrowApy * 100).toFixed(1)}%</span>
                </div>
                {opp.riskScore !== undefined && (
                  <div className="mt-2 flex justify-end">
                    {riskBadge(opp.riskScore)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center text-sm text-gray-500">
            {nodeOnline
              ? "No opportunities available"
              : "Node offline — start the node to see opportunities"}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Markets Monitored
            </p>
            <p className="text-xl font-bold font-mono text-gray-100">
              {totalMarkets || "—"}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Best Spread
            </p>
            <p className="text-xl font-bold font-mono text-emerald-400">
              {bestSpread > 0 ? formatPct(bestSpread) : "—"}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Chains Tracked
            </p>
            <p className="text-xl font-bold font-mono text-gray-100">
              {chainsTracked || "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
