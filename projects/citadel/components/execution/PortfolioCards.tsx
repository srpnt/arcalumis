"use client";

import { CHAIN_NAMES, CHAIN_BADGE_COLORS } from "@/lib/chains";

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

interface ChainBalance {
  chainId: number;
  ethBalance: string;
  tokens?: TokenBalance[];
}

interface PortfolioCardsProps {
  balances: ChainBalance[];
  loading?: boolean;
}

function formatEthBalance(raw: string): string {
  const val = parseFloat(raw);
  if (isNaN(val)) return "0.0000";
  return val.toFixed(4);
}

function formatTokenBalance(raw: string, decimals: number): string {
  const val = parseFloat(raw) / Math.pow(10, decimals);
  if (isNaN(val)) return "0.00";
  if (val >= 1000) return val.toFixed(2);
  if (val >= 1) return val.toFixed(4);
  return val.toFixed(6);
}

export default function PortfolioCards({ balances, loading }: PortfolioCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-800 rounded w-20 mb-3" />
            <div className="h-6 bg-gray-800 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center text-sm text-gray-500">
        No portfolio data available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {balances.map((chain) => {
        const name = CHAIN_NAMES[chain.chainId] || `Chain ${chain.chainId}`;
        const badgeColor =
          CHAIN_BADGE_COLORS[chain.chainId] ||
          "bg-gray-500/20 text-gray-400 border-gray-500/30";

        return (
          <div
            key={chain.chainId}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}
              >
                {name}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500">ETH</span>
                <span className="text-sm font-mono text-gray-200">
                  {formatEthBalance(chain.ethBalance)}
                </span>
              </div>

              {chain.tokens &&
                chain.tokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="flex items-baseline justify-between"
                  >
                    <span className="text-xs text-gray-500">
                      {token.symbol}
                    </span>
                    <span className="text-sm font-mono text-gray-200">
                      {formatTokenBalance(token.balance, token.decimals)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
