"use client";

import { CHAIN_NAMES, CHAIN_BADGE_COLORS, getMorphoMarketUrl } from "@/lib/chains";
import { formatPct } from "@/lib/format";

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

interface PositionsTableProps {
  positions: Position[];
  loading?: boolean;
}

export default function PositionsTable({ positions, loading }: PositionsTableProps) {
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center text-sm text-gray-500">
        No open positions
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Chain
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Supply Shares
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Borrow Shares
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                APY
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {positions.map((pos, i) => {
              const chainName =
                CHAIN_NAMES[pos.chainId] || `Chain ${pos.chainId}`;
              const badgeColor =
                CHAIN_BADGE_COLORS[pos.chainId] ||
                "bg-gray-500/20 text-gray-400 border-gray-500/30";
              const marketUrl = getMorphoMarketUrl(pos.marketId, pos.chainId);
              // Shares are raw on-chain values (18 decimals). Convert to human-readable.
              const supplyShares = parseFloat(pos.supplyShares || "0") / 1e18;
              const borrowShares = parseFloat(pos.borrowShares || "0") / 1e18;

              return (
                <tr
                  key={`${pos.chainId}-${pos.marketId}-${i}`}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}
                    >
                      {chainName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {marketUrl ? (
                      <a
                        href={marketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-200 hover:text-emerald-400 transition-colors"
                      >
                        {pos.collateralAsset || pos.collateralSymbol}/{pos.loanAsset || pos.loanSymbol}
                      </a>
                    ) : (
                      <span className="text-gray-200">
                        {pos.collateralAsset || pos.collateralSymbol}/{pos.loanAsset || pos.loanSymbol}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {supplyShares > 0
                      ? supplyShares.toLocaleString("en-US", {
                          maximumFractionDigits: 4,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {borrowShares > 0
                      ? borrowShares.toLocaleString("en-US", {
                          maximumFractionDigits: 4,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pos.supplyApy !== undefined ? (
                      <span className="text-emerald-400 font-mono text-xs">
                        {formatPct(pos.supplyApy)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
