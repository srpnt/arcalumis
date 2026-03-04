"use client";

import ChainBadge from "@/components/ChainBadge";
import { formatPct, formatUsd } from "@/lib/format";
import type { MorphoVault } from "@/lib/types";

interface HotVaultCardProps {
  vault: MorphoVault;
  vaultUrl: string;
}

export default function HotVaultCard({ vault, vaultUrl }: HotVaultCardProps) {
  return (
    <a
      href={vaultUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/15 rounded-xl p-4 hover:border-emerald-500/30 transition-all"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-200 text-sm">{vault.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <ChainBadge chain={vault.chain} />
            <span className="text-xs text-gray-500">{vault.underlyingAsset}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-400">{formatPct(vault.netApy)}</p>
          <p className="text-xs text-gray-500">{formatUsd(vault.totalAssetsUsd)} TVL</p>
        </div>
      </div>
    </a>
  );
}
