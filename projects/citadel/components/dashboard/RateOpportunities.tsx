"use client";

import Link from "next/link";
import { formatPct } from "@/lib/format";
import { getMorphoVaultUrl } from "@/lib/chains";

interface TopVault {
  name: string;
  netApy: number;
  chain: string;
  chainId: number;
  asset: string;
  address: string;
}

interface RateOpportunitiesProps {
  topVaults: TopVault[];
}

function ChainBadgeInline({ chain }: { chain: string }) {
  const color =
    chain === "Ethereum"
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-blue-400 bg-blue-500/10";
  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${color} shrink-0`}
    >
      {chain === "Ethereum" ? "ETH" : chain === "Base" ? "BASE" : chain}
    </span>
  );
}

export default function RateOpportunities({ topVaults }: RateOpportunitiesProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Rate Opportunities
        </h2>
        <Link
          href="/morpho"
          className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          View all →
        </Link>
      </div>
      {topVaults.length === 0 ? (
        <p className="text-xs text-gray-600 italic py-1">
          Loading vault data...
        </p>
      ) : (
        <div className="space-y-1">
          {topVaults.map((v, i) => (
            <a
              key={i}
              href={getMorphoVaultUrl(v.address, v.chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors group"
            >
              <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-gray-100">
                {v.name}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {v.asset}
              </span>
              <ChainBadgeInline chain={v.chain} />
              <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums">
                {formatPct(v.netApy, 1)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
