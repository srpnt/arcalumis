"use client";

import useSWR from "swr";
import NodeStatus from "@/components/execution/NodeStatus";
import PortfolioCards from "@/components/execution/PortfolioCards";
import PositionsTable from "@/components/execution/PositionsTable";
import { formatAddress } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/chains";

// ============================================================
// Types
// ============================================================

interface NodeStatusData {
  status: string;
  smartAccount?: string;
  chains?: number[];
  uptime?: number;
  [key: string]: unknown;
}

interface ChainBalance {
  chainId: number;
  ethBalance: string;
  tokens?: Array<{
    symbol: string;
    balance: string;
    decimals: number;
  }>;
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
  balances?: ChainBalance[];
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
}

interface OpportunitiesData {
  opportunities: Opportunity[];
}

// ============================================================
// Fetchers
// ============================================================

const nodeFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.offline) throw new Error("offline");
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
};

// ============================================================
// Helpers
// ============================================================

function getExplorerUrl(address: string, chainId?: number): string {
  if (chainId === 8453)
    return `https://basescan.org/address/${address}`;
  if (chainId === 42161)
    return `https://arbiscan.io/address/${address}`;
  if (chainId === 10)
    return `https://optimistic.etherscan.io/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}

// ============================================================
// Page
// ============================================================

export default function ExecutionPage() {
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

  const nodeOnline = !statusError && !!statusData;
  const smartAccount = statusData?.smartAccount || "";
  const positions = positionsData?.positions || [];
  const opportunities = (opportunitiesData?.opportunities || []).slice(0, 5);

  // Map status chains to PortfolioCards format
  const balances = (statusData?.chains || []).map((c: any) => ({
    chainId: c.chainId,
    ethBalance: c.ethFormatted || "0",
    tokens: (c.tokenBalances || []).map((t: any) => ({
      symbol: t.symbol,
      balance: t.balance,
      decimals: ["USDC", "USDT", "EURC"].includes(t.symbol) ? 6 : 18,
    })),
  }));

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-100">
              🏰 Execution
            </h1>
            <NodeStatus online={nodeOnline} loading={statusLoading} />
          </div>
          <p className="text-sm text-gray-500">
            Smart account positions and cross-chain operations
          </p>
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

      {/* Portfolio Section */}
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
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Top Opportunities
        </h2>
        {opportunities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {opportunities.map((opp, i) => (
              <div
                key={`${opp.asset}-${opp.supplyChainId}-${opp.borrowChainId}-${i}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-500/20 transition-colors"
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
                    {opp.supplyChainId ? (CHAIN_NAMES[opp.supplyChainId] || opp.supplyChain) : opp.supplyChain}
                  </span>
                  <span className="mx-1">→</span>
                  <span className="text-gray-400">
                    {opp.borrowChainId ? (CHAIN_NAMES[opp.borrowChainId] || opp.borrowChain) : opp.borrowChain}
                  </span>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                  <span>Supply {(opp.supplyApy * 100).toFixed(1)}%</span>
                  <span>Borrow {(opp.borrowApy * 100).toFixed(1)}%</span>
                </div>
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
    </div>
  );
}
