"use client";

import { formatPct } from "@/lib/format";

function utilizationColor(u: number): string {
  if (u >= 0.9) return "text-red-400";
  if (u >= 0.8) return "text-amber-400";
  return "text-emerald-400";
}

interface HighUtilVault {
  name: string;
  chain: string;
  chainId: number;
  avgUtilization: number;
  netApy: number;
  address: string;
}

interface UtilizationAlertsProps {
  highUtilVaults: HighUtilVault[];
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

export default function UtilizationAlerts({ highUtilVaults }: UtilizationAlertsProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Utilization Alerts
          <span className="relative group">
            <span className="cursor-help text-gray-600 hover:text-gray-400 transition-colors">ⓘ</span>
            <span className="absolute left-6 top-0 z-50 hidden group-hover:block w-64 p-2 text-[11px] text-gray-300 bg-gray-800 border border-gray-700 rounded-lg shadow-xl leading-relaxed">
              Vaults with utilization &gt;85% are under withdrawal pressure. At &gt;95%, the IRM pushes borrow rates to 190%+ APR (emergency mode). Borrowers can&apos;t withdraw, depositors face illiquidity.
            </span>
          </span>
        </h2>
        <span className="text-[10px] text-gray-600 font-mono">
          {highUtilVaults.length > 0
            ? `${highUtilVaults.length} VAULTS &gt;90%`
            : "ALL CLEAR"}
        </span>
      </div>
      {highUtilVaults.length === 0 ? (
        <p className="text-xs text-gray-600 italic py-1">
          No vaults above 90% utilization
        </p>
      ) : (
        <div className="space-y-1">
          {highUtilVaults.map((v, i) => (
            <a
              key={i}
              href={`https://app.morpho.org/vault?vault=${v.address}&network=${v.chainId === 8453 ? "base" : "mainnet"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/60 transition-colors group"
            >
              <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-gray-100">
                {v.name}
              </span>
              <ChainBadgeInline chain={v.chain} />
              <span
                className={`text-xs font-mono font-semibold ${utilizationColor(v.avgUtilization)} tabular-nums`}
              >
                {formatPct(v.avgUtilization, 1)}
              </span>
              <span className="text-[10px] text-gray-600 font-mono tabular-nums w-16 text-right">
                {formatPct(v.netApy, 1)} APY
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
