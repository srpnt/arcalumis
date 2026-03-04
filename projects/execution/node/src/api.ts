/**
 * Citadel Node API
 * Simple HTTP server that exposes node state for the dashboard.
 * 
 * Endpoints:
 *   GET /status          — node status + portfolio
 *   GET /opportunities   — current arbitrage opportunities
 *   GET /positions       — open Morpho positions
 */

import {
  createPublicClient,
  http,
  erc20Abi,
  formatEther,
  formatUnits,
  type Address,
} from "viem";
import { mainnet, base } from "viem/chains";
import { CHAINS, SMART_ACCOUNT, MORPHO_BLUE, TOKENS } from "./config/index.js";
import { fetchAllMarkets, findOpportunities } from "./watcher/morpho.js";

const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };
const PORT = parseInt(process.env.NODE_API_PORT || "4100");

const morphoPositionAbi = [
  {
    name: "position",
    type: "function",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
    stateMutability: "view",
  },
] as const;

function getClient(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  return createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(CHAINS[chainKey].rpcHttp) });
}

// ============================================================
// Data fetchers
// ============================================================

async function getPortfolio() {
  const chains: any[] = [];

  for (const [key, config] of Object.entries(CHAINS)) {
    const client = getClient(config.id);
    const ethBalance = await client.getBalance({ address: SMART_ACCOUNT });

    const tokenBalances: any[] = [];
    const knownTokens = [
      ...Object.entries(TOKENS).map(([sym, addrs]) => ({
        symbol: sym,
        address: addrs[config.id],
        decimals: ["USDC", "USDT", "EURC"].includes(sym) ? 6 : 18,
      })).filter((t) => t.address),
    ];

    // Add WETH
    if (config.id === 8453) knownTokens.push({ symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as Address, decimals: 18 });
    if (config.id === 1) knownTokens.push({ symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address, decimals: 18 });

    for (const token of knownTokens) {
      try {
        const bal = await client.readContract({
          address: token.address!,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [SMART_ACCOUNT],
        });
        if (bal > 0n) {
          tokenBalances.push({
            symbol: token.symbol,
            address: token.address,
            balance: bal.toString(),
            formatted: formatUnits(bal, token.decimals),
          });
        }
      } catch {}
    }

    chains.push({
      chainId: config.id,
      name: config.name,
      ethBalance: ethBalance.toString(),
      ethFormatted: formatEther(ethBalance),
      tokenBalances,
    });
  }

  return { smartAccount: SMART_ACCOUNT, chains };
}

async function getPositions() {
  const allPositions: any[] = [];

  for (const [key, config] of Object.entries(CHAINS)) {
    const client = getClient(config.id);

    // Fetch markets
    const res = await fetch("https://api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { markets(first: 200, where: { chainId_in: [${config.id}], listed: true }, orderBy: SupplyAssetsUsd, orderDirection: Desc) { items { uniqueKey loanAsset { address symbol } collateralAsset { address symbol } oracleAddress irmAddress lltv state { supplyApy borrowApy supplyAssetsUsd } } } }`,
      }),
    });
    const data = await res.json();
    const markets = data.data?.markets?.items || [];

    for (const m of markets) {
      try {
        const [supplyShares, borrowShares, collateral] = await client.readContract({
          address: MORPHO_BLUE[config.id],
          abi: morphoPositionAbi,
          functionName: "position",
          args: [m.uniqueKey as `0x${string}`, SMART_ACCOUNT],
        });

        if (supplyShares > 0n || borrowShares > 0n || collateral > 0n) {
          allPositions.push({
            chainId: config.id,
            chain: config.name,
            marketId: m.uniqueKey,
            loanAsset: m.loanAsset.symbol,
            collateralAsset: m.collateralAsset.symbol,
            supplyShares: supplyShares.toString(),
            borrowShares: borrowShares.toString(),
            collateral: collateral.toString(),
            supplyApy: m.state.supplyApy,
            tvl: m.state.supplyAssetsUsd,
          });
        }
      } catch {}
    }
  }

  return allPositions;
}

async function getOpportunities() {
  const markets = await fetchAllMarkets();
  const targetChainIds = Object.values(CHAINS).map((c) => c.id);
  return findOpportunities(markets, { minSpreadPct: 0.5, targetChainIds });
}

// ============================================================
// HTTP Server
// ============================================================

import { createServer } from "http";

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    if (req.url === "/status") {
      const portfolio = await getPortfolio();
      res.end(JSON.stringify({ status: "ok", timestamp: Date.now(), ...portfolio }));
    } else if (req.url === "/positions") {
      const positions = await getPositions();
      res.end(JSON.stringify({ positions, timestamp: Date.now() }));
    } else if (req.url === "/opportunities") {
      const opps = await getOpportunities();
      res.end(JSON.stringify({
        count: opps.length,
        opportunities: opps.slice(0, 20).map((o) => ({
          asset: o.asset,
          grossSpread: o.grossSpread,
          organicSpread: o.organicSpread,
          rewardDependencyPct: o.rewardDependencyPct,
          supplyChain: o.supplyMarket.chain,
          supplyApy: o.supplyMarket.supplyApyWithRewards,
          borrowChain: o.borrowMarket.chain,
          borrowApy: o.borrowMarket.borrowApy,
        })),
        timestamp: Date.now(),
      }));
    } else {
      res.end(JSON.stringify({ name: "Citadel Node API", endpoints: ["/status", "/positions", "/opportunities"] }));
    }
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT);

console.log(`🏰 Citadel Node API running on http://localhost:${PORT}`);
