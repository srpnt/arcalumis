"use client";

import { useState } from "react";
import { formatUsd } from "@/lib/format";
import { CHAIN_NAMES, CHAIN_COLORS } from "./constants";
import { getEtherscanUrl, formatAddress } from "./helpers";
import type { CuratorData, CuratorVault } from "./types";

function CuratorVaultRow({ vault }: { vault: CuratorVault }) {
  const chainColor = CHAIN_COLORS[vault.chainId] || "bg-gray-800 text-gray-400 border-gray-700";
  const morphoUrl = `https://app.morpho.org/vault?vault=${vault.address}&network=${vault.chainNetwork}`;
  const apyDisplay = vault.netApy > 0 ? `${(vault.netApy * 100).toFixed(2)}%` : "—";

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      <a
        href={morphoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-300 hover:text-emerald-400 transition-colors truncate min-w-0 flex-1"
        title={vault.name}
      >
        {vault.name}
      </a>
      <span className={`px-1 py-0.5 text-[9px] rounded border shrink-0 ${chainColor}`}>
        {CHAIN_NAMES[vault.chainId]?.slice(0, 3) || "?"}
      </span>
      <span className="text-gray-500 shrink-0 w-10 text-right font-mono">{vault.assetSymbol}</span>
      <span className="text-gray-300 shrink-0 w-16 text-right font-mono">{formatUsd(vault.totalAssetsUsd)}</span>
      <span className={`shrink-0 w-14 text-right font-mono ${vault.netApy > 0.05 ? "text-emerald-400" : "text-gray-400"}`}>{apyDisplay}</span>
    </div>
  );
}

export default function CuratorCard({ curator }: { curator: CuratorData }) {
  const [vaultsOpen, setVaultsOpen] = useState(false);

  const ethAddresses = curator.addresses
    .filter((a) => a.chainId === 1 || a.chainId === 8453)
    .reduce((acc, a) => {
      if (!acc.find((x) => x.address.toLowerCase() === a.address.toLowerCase())) acc.push(a);
      return acc;
    }, [] as { chainId: number; address: string }[]);

  const sortedVaults = [...curator.vaults].sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {curator.image && (
            <img
              src={curator.image}
              alt={curator.name}
              className="w-8 h-8 rounded-full bg-gray-800"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
              {curator.name}
              {curator.verified && (
                <span className="text-emerald-500 text-xs" title="Verified">✓</span>
              )}
            </h3>
          </div>
        </div>
      </div>

      {curator.aum > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">AUM (Morpho Vaults)</p>
          <p className="text-lg font-bold text-gray-100">{formatUsd(curator.aum)}</p>
        </div>
      )}

      {ethAddresses.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Addresses</p>
          <div className="flex flex-col gap-1">
            {ethAddresses.slice(0, 4).map((addr, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[9px] rounded border ${CHAIN_COLORS[addr.chainId] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
                  {CHAIN_NAMES[addr.chainId] || `Chain ${addr.chainId}`}
                </span>
                <a
                  href={getEtherscanUrl(addr.address, addr.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
                >
                  {formatAddress(addr.address)}
                </a>
              </div>
            ))}
            {ethAddresses.length > 4 && (
              <span className="text-[10px] text-gray-600">+{ethAddresses.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {(curator.vaults.length > 0 || curator.vaultsLoading) && (
        <div className="mb-3 border-t border-gray-800/50 pt-2">
          <button
            onClick={() => setVaultsOpen(!vaultsOpen)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition-colors w-full text-left"
          >
            <span className="transition-transform duration-200" style={{ display: 'inline-block', transform: vaultsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▸
            </span>
            {curator.vaultsLoading ? (
              <span className="animate-pulse">Loading vaults...</span>
            ) : (
              <span>Vaults ({curator.vaults.length})</span>
            )}
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: vaultsOpen ? `${Math.max(sortedVaults.length * 32 + 16, 48)}px` : '0px',
              opacity: vaultsOpen ? 1 : 0,
            }}
          >
            <div className="mt-2 space-y-0">
              {sortedVaults.map((vault) => (
                <CuratorVaultRow key={`${vault.address}-${vault.chainId}`} vault={vault} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
