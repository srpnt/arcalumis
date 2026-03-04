"use client";

import { formatUsd } from "@/lib/format";
import type { TokenTransfer } from "./types";

interface TokenActivityFeedProps {
  transfers: TokenTransfer[];
  loading: boolean;
  error: string | null;
}

export default function TokenActivityFeed({ transfers, loading, error }: TokenActivityFeedProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading MORPHO token activity...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
        ⚠️ {error}
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">No recent MORPHO transfer activity found.</p>
      </div>
    );
  }

  const largeCount = transfers.filter(t => t.isLarge).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-6">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Recent Transfers</p>
          <p className="text-lg font-bold text-gray-100">{transfers.length}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Large Movements (&gt;100K)</p>
          <p className="text-lg font-bold text-amber-400">{largeCount}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Total Volume</p>
          <p className="text-lg font-bold text-gray-100">
            {formatUsd(transfers.reduce((sum, t) => sum + t.valueUsd, 0))}
          </p>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recent MORPHO Token Transfers
          </h3>
        </div>
        <div className="divide-y divide-gray-800/50">
          {transfers.map((t, i) => (
            <div
              key={i}
              className={`px-4 py-3 hover:bg-gray-800/30 ${t.isLarge ? "border-l-2 border-amber-500" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    {t.isLarge && <span title="Large movement (&gt;100K MORPHO)">🐋</span>}
                    <a
                      href={`https://etherscan.io/address/${t.fromAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-gray-300 hover:text-emerald-400 transition-colors text-xs"
                    >
                      {t.from}
                    </a>
                    <span className="text-gray-600">→</span>
                    <a
                      href={`https://etherscan.io/address/${t.toAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-gray-300 hover:text-emerald-400 transition-colors text-xs"
                    >
                      {t.to}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-mono font-medium ${t.isLarge ? "text-amber-400" : "text-gray-200"}`}>
                      {t.amount >= 1000 ? `${(t.amount / 1000).toFixed(1)}K` : t.amount.toFixed(0)} MORPHO
                    </span>
                    {t.valueUsd > 0 && (
                      <span className="text-[10px] text-gray-500">({formatUsd(t.valueUsd)})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-gray-600">{t.time}</span>
                  {t.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${t.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-600 hover:text-emerald-400 font-mono"
                    >
                      tx →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
