"use client";

import useSWR from "swr";
import MetricCard from "@/components/MetricCard";
import OpportunityTable from "@/components/arbitrage/OpportunityTable";
import ChainOverview from "@/components/arbitrage/ChainOverview";
import { formatUsd, formatPct } from "@/lib/format";
import type { ArbitrageData } from "@/lib/types";

async function fetchArbitrage(): Promise<ArbitrageData> {
  const res = await fetch("/api/arbitrage");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function ArbitragePage() {
  const { data, error, isLoading } = useSWR<ArbitrageData>(
    "arbitrage-data",
    fetchArbitrage,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  );

  // Compute hot chains (appear most in top 50 opportunities)
  const hotChains = new Set<string>();
  if (data?.opportunities) {
    const freq = new Map<string, number>();
    for (const opp of data.opportunities.slice(0, 50)) {
      freq.set(opp.supplyChain, (freq.get(opp.supplyChain) || 0) + 1);
      freq.set(opp.borrowChain, (freq.get(opp.borrowChain) || 0) + 1);
    }
    // Top 5 chains by frequency
    [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([chain]) => hotChains.add(chain));
  }

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            ⚡ Cross-Chain Arbitrage
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Morpho-to-Morpho rate differentials across all chains
          </p>
        </div>
        {data && (
          <p className="text-xs text-gray-600 mt-2 sm:mt-0">
            Updated {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        )}
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
          <div className="inline-block animate-pulse">
            Scanning Morpho markets across all chains...
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <MetricCard
              label="Opportunities"
              value={String(data.totalOpportunities)}
              subtitle=">0.5% spread"
              icon="🎯"
            />
            <MetricCard
              label="Best Spread"
              value={formatPct(data.bestSpread)}
              icon="📈"
            />
            <MetricCard
              label="Chains"
              value={String(data.chainsMonitored)}
              subtitle="monitored"
              icon="🌐"
            />

          </div>

          {/* Main Opportunity Table */}
          <div className="mb-8">
            <OpportunityTable
              opportunities={data.opportunities}
              assetBreakdowns={data.assetBreakdowns}
            />
          </div>

          {/* Chain Overview */}
          <ChainOverview
            chains={data.chainSummaries}
            hotChains={hotChains}
          />
        </>
      )}
    </div>
  );
}
