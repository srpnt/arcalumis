/**
 * Citadel Watcher — Main entry point
 * Monitors Morpho rates + portfolio state, logs opportunities
 */

import { fetchAllMarkets, findOpportunities } from "./morpho.js";
import { fetchPortfolio, formatPortfolio } from "./portfolio.js";
import { CHAINS } from "../config/index.js";

async function runScan() {
  console.log("═".repeat(60));
  console.log(`Citadel Watcher — ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  // 1. Fetch portfolio
  console.log("\n📊 Fetching portfolio...");
  try {
    const portfolio = await fetchPortfolio();
    console.log(formatPortfolio(portfolio));
  } catch (err: any) {
    console.error("Portfolio fetch failed:", err.message);
  }

  // 2. Fetch Morpho markets
  console.log("🔍 Scanning Morpho markets...");
  const markets = await fetchAllMarkets();
  console.log(`  Found ${markets.length} markets across all chains`);

  // Filter to our target chains
  const targetChainIds = Object.values(CHAINS).map((c) => c.id);
  const targetMarkets = markets.filter((m) =>
    targetChainIds.includes(m.chainId)
  );
  console.log(
    `  ${targetMarkets.length} markets on target chains (${targetChainIds.join(", ")})`
  );

  // 3. Find opportunities
  const allOpps = findOpportunities(markets, {
    minSpreadPct: 0.5,
    targetChainIds,
  });

  console.log(`\n⚡ ${allOpps.length} cross-chain opportunities (>0.5% spread)`);

  // Low risk only (positive borrow, organic)
  const lowRiskOpps = findOpportunities(markets, {
    minSpreadPct: 1.0,
    targetChainIds,
    positiveborrowOnly: true,
    minSupplyTvl: 500_000,
  });

  console.log(
    `🎯 ${lowRiskOpps.length} low-risk opportunities (>1%, positive borrow, >$500K TVL)`
  );

  // Print top opportunities
  if (allOpps.length > 0) {
    console.log("\n── Top Opportunities ──");
    for (const opp of allOpps.slice(0, 10)) {
      const s = opp.supplyMarket;
      const b = opp.borrowMarket;
      const rewardTag =
        opp.rewardDependencyPct > 0.5
          ? " [reward-dep]"
          : opp.rewardDependencyPct > 0
          ? " [partial-reward]"
          : " [organic]";

      console.log(
        `  ${opp.asset.padEnd(8)} | ${(opp.grossSpread * 100).toFixed(2).padStart(6)}% spread | ` +
          `Supply ${(s.supplyApyWithRewards * 100).toFixed(2)}% on ${s.chain} | ` +
          `Borrow ${(b.borrowApy * 100).toFixed(2)}% on ${b.chain} | ` +
          `Liq $${(s.liquidityUsd / 1e6).toFixed(1)}M${rewardTag}`
      );
    }
  }

  if (lowRiskOpps.length > 0) {
    console.log("\n── Low-Risk Opportunities ──");
    for (const opp of lowRiskOpps.slice(0, 5)) {
      const s = opp.supplyMarket;
      const b = opp.borrowMarket;
      console.log(
        `  🎯 ${opp.asset.padEnd(8)} | ${(opp.grossSpread * 100).toFixed(2)}% spread | ` +
          `Supply ${(s.supplyApyWithRewards * 100).toFixed(2)}% on ${s.chain} (util: ${(s.utilization * 100).toFixed(0)}%, liq: $${(s.liquidityUsd / 1e6).toFixed(1)}M) | ` +
          `Borrow ${(b.effectiveBorrowApy * 100).toFixed(2)}% on ${b.chain}`
      );
    }
  }

  console.log("\n" + "═".repeat(60));
}

// Run once or loop
const LOOP = process.argv.includes("--loop");
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function main() {
  await runScan();

  if (LOOP) {
    console.log(`\nLooping every ${INTERVAL_MS / 1000}s. Press Ctrl+C to stop.\n`);
    setInterval(runScan, INTERVAL_MS);
  }
}

main().catch(console.error);
