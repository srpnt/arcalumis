import { fetchVaults, fetchMarkets } from "@/lib/morpho";
import { loadAllSignals } from "@/lib/signals";
import { formatUsd, formatPct } from "@/lib/format";
import Link from "next/link";
import ChainDonut from "@/components/ChainDonut";

export const revalidate = 300; // 5 minutes

const NAV_CARDS = [
  {
    href: "/morpho",
    icon: "📊",
    title: "Morpho Markets",
    desc: "Explore vaults, markets, and yield opportunities across Ethereum and Base",
  },
  {
    href: "/differentials",
    icon: "🔀",
    title: "Cross-Chain Differentials",
    desc: "Compare rates between chains and find arbitrage opportunities",
  },
  {
    href: "/signals",
    icon: "🚨",
    title: "Signals & Alerts",
    desc: "Research findings, risk alerts, and ecosystem intelligence",
  },
  {
    href: "/arkham",
    icon: "🔍",
    title: "Arkham Intel",
    desc: "On-chain entity lookup, wallet analysis, and transfer tracking",
  },
];

export default async function Home() {
  let totalTvl = 0;
  let ethTvl = 0;
  let baseTvl = 0;
  let bestYield = 0;
  let bestVaultName = "";
  let bestVaultAddress = "";
  let bestVaultChainId = 1;
  let marketsCount = 0;
  let signalsCount = 0;

  try {
    const [vaults, markets] = await Promise.all([
      fetchVaults(),
      fetchMarkets(),
    ]);

    totalTvl = vaults.reduce((sum, v) => sum + v.totalAssetsUsd, 0);
    ethTvl = vaults
      .filter((v) => v.chainId === 1)
      .reduce((sum, v) => sum + v.totalAssetsUsd, 0);
    baseTvl = vaults
      .filter((v) => v.chainId === 8453)
      .reduce((sum, v) => sum + v.totalAssetsUsd, 0);
    marketsCount = markets.length;

    for (const v of vaults) {
      if (v.netApy > bestYield) {
        bestYield = v.netApy;
        bestVaultName = v.name;
        bestVaultAddress = v.address;
        bestVaultChainId = v.chainId;
      }
    }
  } catch (e) {
    console.error("Failed to fetch Morpho data:", e);
  }

  try {
    const signals = loadAllSignals();
    signalsCount = signals.length;
  } catch (e) {
    console.error("Failed to load signals:", e);
  }

  const morphoVaultUrl = bestVaultAddress
    ? `https://app.morpho.org/vault?vault=${bestVaultAddress}&network=${bestVaultChainId === 8453 ? "base" : "mainnet"}`
    : "/morpho";

  return (
    <div className="pt-8 md:pt-0">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
          The Citadel
        </h1>
        <p className="mt-3 text-gray-500 text-sm">
          On-chain Intelligence & Capital Deployment
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/morpho">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Total TVL
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {formatUsd(totalTvl)}
            </p>
            <p className="mt-1 text-xs text-gray-500">Across all vaults</p>
          </div>
        </Link>

        <a href={morphoVaultUrl} target="_blank" rel="noopener noreferrer">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              🔥 Best Yield
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              {formatPct(bestYield)}
            </p>
            <p className="mt-1 text-xs text-gray-500 truncate">
              {bestVaultName || "—"}
            </p>
          </div>
        </a>

        <Link href="/signals">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Active Signals
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {signalsCount}
            </p>
            <p className="mt-1 text-xs text-gray-500">From research scans</p>
          </div>
        </Link>

        <Link href="/morpho">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Markets Tracked
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-100">
              {marketsCount}
            </p>
            <p className="mt-1 text-xs text-gray-500">Ethereum + Base</p>
          </div>
        </Link>
      </div>

      {/* Mini Chart Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <ChainDonut ethTvl={ethTvl} baseTvl={baseTvl} />
        <div className="sm:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm">📈 Sparklines & trends coming soon</p>
            <p className="text-gray-600 text-xs mt-1">Time series data needed for historical charts</p>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {NAV_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all cursor-pointer group">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{card.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Timestamp */}
      <div className="text-center text-xs text-gray-600">
        Last updated: {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
      </div>
    </div>
  );
}
