"use client";

import type { AssetChainData } from "@/lib/types";
import { getMorphoMarketUrl } from "@/lib/types";
import { formatUsd, formatPct } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AssetChainBreakdownProps {
  asset: string;
  chains: AssetChainData[];
}

interface ChartPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function MiniTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-gray-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {((p.value || 0) as number).toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

export default function AssetChainBreakdown({
  asset,
  chains,
}: AssetChainBreakdownProps) {
  const chartData = chains
    .sort((a, b) => b.supplyTvl - a.supplyTvl)
    .map((c) => ({
      chain: c.chain,
      "Supply APY": +(c.bestSupplyApy * 100).toFixed(2),
      "Borrow APY": +(c.lowestBorrowApy * 100).toFixed(2),
    }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        {asset} — All Chains
      </h3>

      {/* Mini chart */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={Math.max(120, chains.length * 36)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis
              type="number"
              stroke="#4b5563"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="chain"
              stroke="#4b5563"
              tick={{ fill: "#d1d5db", fontSize: 11 }}
              width={80}
            />
            <Tooltip content={<MiniTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
            />
            <Bar dataKey="Supply APY" fill="#34d399" radius={[0, 3, 3, 0]} />
            <Bar dataKey="Borrow APY" fill="#60a5fa" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {chains
          .sort((a, b) => b.supplyTvl - a.supplyTvl)
          .map((c) => (
            <div
              key={c.chainId}
              className="bg-gray-900/60 rounded-md px-3 py-2 text-xs"
            >
              <p className="font-medium text-gray-300 mb-1">
                {(() => {
                  const supplyUrl = getMorphoMarketUrl(c.bestSupplyMarketId, c.chainId);
                  if (supplyUrl) {
                    return (
                      <a
                        href={supplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white underline decoration-gray-600 underline-offset-2 hover:decoration-gray-400 transition-colors"
                      >
                        {c.chain}
                        <span className="ml-0.5 text-[9px] opacity-60">↗</span>
                      </a>
                    );
                  }
                  return c.chain;
                })()}
              </p>
              <div className="flex justify-between text-gray-500">
                <span>Supply</span>
                <span className="text-emerald-400 font-mono">
                  {formatPct(c.bestSupplyApy)}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Borrow</span>
                <span className="text-blue-400 font-mono">
                  {c.lowestBorrowApy > 0 ? (
                    (() => {
                      const borrowUrl = getMorphoMarketUrl(c.lowestBorrowMarketId, c.chainId);
                      if (borrowUrl) {
                        return (
                          <a
                            href={borrowUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-300 underline decoration-blue-800 underline-offset-2 hover:decoration-blue-500 transition-colors"
                          >
                            {formatPct(c.lowestBorrowApy)}
                            <span className="ml-0.5 text-[9px] opacity-60">↗</span>
                          </a>
                        );
                      }
                      return formatPct(c.lowestBorrowApy);
                    })()
                  ) : "—"}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>TVL</span>
                <span className="text-gray-400 font-mono">
                  {formatUsd(c.supplyTvl)}
                </span>
              </div>
              {c.rewardTokens.length > 0 && (
                <p className="text-amber-400 mt-0.5">
                  🎁 {c.rewardTokens.join(", ")}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
