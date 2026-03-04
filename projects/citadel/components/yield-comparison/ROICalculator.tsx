"use client";

import { formatPct, formatUsd } from "@/lib/format";
import type { ChainRate } from "@/lib/types";

interface ROICalculatorProps {
  diffs: ChainRate[];
  capital: number;
  setCapital: (v: number) => void;
  selectedAsset: string;
  setSelectedAsset: (v: string) => void;
}

export default function ROICalculator({
  diffs, capital, setCapital, selectedAsset, setSelectedAsset,
}: ROICalculatorProps) {
  const asset = selectedAsset || (diffs.length > 0 ? diffs[0].asset : "");
  const diff = diffs.find((d) => d.asset === asset);

  const ethRate = diff?.ethBestApy ?? 0;
  const baseRate = diff?.baseBestApy ?? 0;
  const spread = diff?.spread ?? 0;
  const absSpread = Math.abs(spread);
  const annualDiff = capital * absSpread;
  const monthlyDiff = annualDiff / 12;
  const bridgeCost = 12;
  const netAnnualGain = annualDiff - bridgeCost;
  const higherChain = spread >= 0 ? "Ethereum" : "Base";
  const lowerChain = spread >= 0 ? "Base" : "Ethereum";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
      <h2 className="text-sm font-semibold text-gray-400 mb-4">🧮 ROI Calculator — Cross-Chain Arbitrage</h2>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Capital (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input type="number" value={capital}
                onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Asset</label>
            <select value={asset} onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-emerald-500/50">
              {diffs.map((d) => <option key={d.asset} value={d.asset}>{d.asset}</option>)}
            </select>
          </div>
        </div>

        <div className="lg:w-2/3">
          {diff ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase">ETH Rate</p>
                  <p className="text-lg font-bold text-emerald-400 font-mono">{formatPct(ethRate)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase">Base Rate</p>
                  <p className="text-lg font-bold text-blue-400 font-mono">{formatPct(baseRate)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase">Spread</p>
                  <p className={`text-lg font-bold font-mono ${absSpread > 0.01 ? "text-emerald-400" : "text-gray-400"}`}>
                    {formatPct(absSpread)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase">Annual Yield Difference</p>
                  <p className="text-xl font-bold text-gray-100 font-mono">{formatUsd(annualDiff)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase">Monthly Yield Difference</p>
                  <p className="text-xl font-bold text-gray-100 font-mono">{formatUsd(monthlyDiff)}</p>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
                <p className="text-sm text-gray-300">
                  If you move <span className="text-gray-100 font-medium font-mono">{formatUsd(capital)}</span> of{" "}
                  <span className="text-gray-100 font-medium">{asset}</span> from {lowerChain} to {higherChain},
                  you earn <span className="text-emerald-400 font-bold font-mono">{formatUsd(annualDiff)}</span>/year more.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Est. bridge cost: ~${bridgeCost} ({lowerChain}→{higherChain})
                  {" · "}Net annual gain: <span className="text-emerald-400 font-mono">{formatUsd(Math.max(0, netAnnualGain))}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select an asset to see ROI calculations.</p>
          )}
        </div>
      </div>
    </div>
  );
}
