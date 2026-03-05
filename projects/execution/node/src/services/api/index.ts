/**
 * API Service
 * 
 * Thin HTTP read layer over the shared data directory.
 * Reads from data/ files written by other services.
 * 
 * Endpoints:
 *   GET /status          — node status + portfolio
 *   GET /opportunities   — current arbitrage opportunities
 *   GET /positions       — open Morpho positions (from monitor data)
 *   GET /plans           — list execution plans with status
 *   GET /monitor         — latest monitor status
 */

import { createServer } from "http";
import { SMART_ACCOUNT } from "../../shared/config.js";
import { readData, listDataFiles } from "../../shared/store.js";
import type { StoredPlan, MonitorStatus, PortfolioState } from "../../shared/types.js";

const PORT = parseInt(process.env.NODE_API_PORT || "4100");

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    if (req.url === "/status") {
      const portfolio = readData<PortfolioState>("portfolio.json");
      const monitor = readData<MonitorStatus>("monitor.json");
      res.end(JSON.stringify({
        status: "ok",
        timestamp: Date.now(),
        smartAccount: SMART_ACCOUNT,
        portfolio,
        monitor: monitor ? {
          lastCheck: monitor.timestamp,
          alertCount: monitor.alerts.length,
          criticalAlerts: monitor.alerts.filter((a) => a.level === "critical").length,
        } : null,
      }));

    } else if (req.url === "/opportunities") {
      const data = readData<any>("opportunities.json");
      if (!data) {
        res.end(JSON.stringify({ count: 0, opportunities: [], timestamp: null }));
        return;
      }
      res.end(JSON.stringify({
        count: data.all?.length || 0,
        lowRiskCount: data.lowRisk?.length || 0,
        opportunities: (data.all || []).slice(0, 20).map((o: any) => ({
          asset: o.asset,
          grossSpread: o.grossSpread,
          organicSpread: o.organicSpread,
          rewardDependencyPct: o.rewardDependencyPct,
          supplyChain: o.supplyMarket?.chain,
          supplyApy: o.supplyMarket?.supplyApyWithRewards,
          borrowChain: o.borrowMarket?.chain,
          borrowApy: o.borrowMarket?.borrowApy,
        })),
        timestamp: data.timestamp,
      }));

    } else if (req.url === "/positions") {
      const monitor = readData<MonitorStatus>("monitor.json");
      if (!monitor) {
        res.end(JSON.stringify({ positions: [], timestamp: null }));
        return;
      }
      const allPositions: any[] = [];
      for (const [chainId, chain] of Object.entries(monitor.chains)) {
        for (const pos of chain.morphoPositions) {
          allPositions.push({
            chainId: Number(chainId),
            chain: chain.chainName,
            ...pos,
          });
        }
      }
      res.end(JSON.stringify({ positions: allPositions, timestamp: monitor.timestamp }));

    } else if (req.url === "/plans") {
      const planFiles = listDataFiles("plans");
      const plans: any[] = [];
      for (const f of planFiles) {
        const p = readData<StoredPlan>(`plans/${f}`);
        if (p) {
          plans.push({
            id: p.plan.id,
            status: p.status,
            asset: p.plan.opportunity.asset,
            spread: p.plan.opportunity.grossSpread,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            error: p.error,
          });
        }
      }
      res.end(JSON.stringify({ plans, count: plans.length, timestamp: Date.now() }));

    } else if (req.url === "/monitor") {
      const monitor = readData<MonitorStatus>("monitor.json");
      if (!monitor) {
        res.end(JSON.stringify({ status: "no data", timestamp: null }));
        return;
      }
      res.end(JSON.stringify(monitor));

    } else {
      res.end(JSON.stringify({
        name: "Citadel Node API",
        endpoints: ["/status", "/opportunities", "/positions", "/plans", "/monitor"],
      }));
    }
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT);

console.log(`🏰 Citadel Node API running on http://localhost:${PORT}`);
console.log(`   Endpoints: /status /opportunities /positions /plans /monitor`);
