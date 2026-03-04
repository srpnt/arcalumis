"use client";

import { formatUsd } from "@/lib/format";
import { CHAIN_NAMES, CHAIN_COLORS } from "./constants";
import { getEtherscanUrl, formatAddress } from "./helpers";
import { getMorphoVaultUrl } from "@/lib/chains";
import type { VaultConcentrationEntry } from "./types";

interface VaultConcentrationTableProps {
  entries: VaultConcentrationEntry[];
  loading: boolean;
  error: string | null;
}

export default function VaultConcentrationTable({ entries, loading, error }: VaultConcentrationTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading vault depositor data...</div>
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

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">No vault concentration data available.</p>
      </div>
    );
  }

  const criticalVaults = new Set(
    entries.filter((e) => e.percentOfVault > 50).map((e) => `${e.vaultAddress}-${e.chainId}`)
  ).size;
  const uniqueVaults = new Set(entries.map((e) => `${e.vaultAddress}-${e.chainId}`)).size;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Vaults Analyzed</p>
          <p className="text-lg font-bold text-gray-100">{uniqueVaults}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">&gt;50% Single-Depositor</p>
          <p className={`text-lg font-bold ${criticalVaults > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {criticalVaults} vault{criticalVaults !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Positions Tracked</p>
          <p className="text-lg font-bold text-gray-100">{entries.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vault</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deposited</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Vault</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Concentration Risk</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const chainColor = CHAIN_COLORS[e.chainId] || "bg-gray-800 text-gray-400 border-gray-700";
                return (
                  <tr key={`${e.userAddress}-${e.vaultAddress}-${e.chainId}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-3 text-gray-500 text-xs">{e.rank}</td>
                    <td className="px-3 py-3">
                      <div>
                        {e.isLikelyContract && (
                          <span className="text-[10px] text-gray-500 block" title="Likely contract/bridge">🤖 contract</span>
                        )}
                        <a
                          href={getEtherscanUrl(e.userAddress, e.chainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          {formatAddress(e.userAddress)}
                        </a>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={getMorphoVaultUrl(e.vaultAddress, e.chainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-300 hover:text-emerald-400 transition-colors"
                        >
                          {e.vaultName}
                        </a>
                        <span className={`px-1.5 py-0.5 text-[9px] rounded border ${chainColor}`}>
                          {CHAIN_NAMES[e.chainId]?.slice(0, 3) || "?"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-200 text-xs">
                      {formatUsd(e.depositedUsd)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <span className={`font-mono font-medium ${
                        e.percentOfVault >= 50 ? "text-red-400" :
                        e.percentOfVault >= 25 ? "text-amber-400" :
                        "text-gray-300"
                      }`}>
                        {e.percentOfVault.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        e.riskLevel === "critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        e.riskLevel === "high" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {e.riskEmoji} {e.riskLevel === "critical" ? "Critical" : e.riskLevel === "high" ? "High" : "Moderate"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
