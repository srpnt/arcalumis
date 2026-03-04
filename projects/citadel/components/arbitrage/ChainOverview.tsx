"use client";

import type { ChainSummary } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";

interface ChainOverviewProps {
  chains: ChainSummary[];
  /** Set of chain names that appear most frequently in opportunities */
  hotChains: Set<string>;
}

export default function ChainOverview({ chains, hotChains }: ChainOverviewProps) {
  if (!chains.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">
          🌐 Chain Overview
        </h2>
        <span className="text-xs text-gray-600">
          {chains.length} chains active
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                Chain
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                Supply TVL
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                Markets
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                Best Supply
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                Low Borrow
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                Assets
              </th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => (
              <tr
                key={c.chainId}
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                  hotChains.has(c.chain) ? "bg-emerald-500/[0.03]" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-200">
                  <div className="flex items-center gap-2">
                    {hotChains.has(c.chain) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    {c.chain}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-400 font-mono">
                  {formatUsd(c.totalSupplyTvl)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-400 font-mono">
                  {c.marketCount}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">
                  {formatPct(c.bestSupplyApy)}
                </td>
                <td className="px-4 py-2.5 text-right text-blue-400 font-mono">
                  {c.lowestBorrowApy > 0 ? formatPct(c.lowestBorrowApy) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                  {c.assets.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
