/**
 * Portfolio Watcher
 * Tracks balances and positions across all chains for our smart account
 */

import {
  createPublicClient,
  http,
  formatEther,
  type Address,
  erc20Abi,
} from "viem";
import { mainnet, base } from "viem/chains";
import { CHAINS, SMART_ACCOUNT, TOKENS } from "../config.js";
import type { ChainPortfolio, PortfolioState, TokenBalance } from "../types.js";

// Chain objects for viem
const VIEM_CHAINS: Record<number, any> = {
  1: mainnet,
  8453: base,
};

function getViemChain(chainId: number) {
  if (chainId === 1) return mainnet;
  if (chainId === 8453) return base;
  throw new Error(`Unknown viem chain ${chainId}`);
}

function getClient(chainId: number) {
  const chainKey = Object.keys(CHAINS).find(
    (k) => CHAINS[k].id === chainId
  );
  if (!chainKey) throw new Error(`Unknown chain ${chainId}`);
  const config = CHAINS[chainKey];
  return createPublicClient({
    chain: getViemChain(chainId),
    transport: http(config.rpcHttp),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEthBalance(
  client: any,
  address: Address
): Promise<bigint> {
  return client.getBalance({ address });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTokenBalance(
  client: any,
  tokenAddress: Address,
  ownerAddress: Address
): Promise<bigint> {
  try {
    return await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [ownerAddress],
    });
  } catch {
    return 0n;
  }
}

export async function fetchPortfolio(): Promise<PortfolioState> {
  const portfolio: PortfolioState = {
    timestamp: Date.now(),
    smartAccount: SMART_ACCOUNT,
    chains: {},
    totalValueUsd: 0,
  };

  for (const [chainKey, chainConfig] of Object.entries(CHAINS)) {
    const client = getClient(chainConfig.id);

    // ETH balance
    const ethBalance = await getEthBalance(client, SMART_ACCOUNT);

    // Token balances
    const tokenBalances: TokenBalance[] = [];
    for (const [symbol, addresses] of Object.entries(TOKENS)) {
      const tokenAddr = addresses[chainConfig.id];
      if (!tokenAddr) continue;

      const balance = await getTokenBalance(
        client,
        tokenAddr,
        SMART_ACCOUNT
      );

      tokenBalances.push({
        token: symbol,
        address: tokenAddr,
        balance,
        balanceUsd: 0, // TODO: price feed
      });
    }

    // Also check EOA balances (for gas)
    const eoaEthBalance = await getEthBalance(
      client,
      // Read from config — the EOA that owns the smart account
      "0xb072735d3A64169F164A569356eCf7b15f3531Aa" as Address
    );

    portfolio.chains[chainConfig.id] = {
      chainId: chainConfig.id,
      chain: chainConfig.name,
      ethBalance,
      ethBalanceUsd: 0, // TODO: price feed
      tokenBalances,
      morphoSupplies: [], // TODO: read from Morpho
      morphoBorrows: [], // TODO: read from Morpho
    };
  }

  return portfolio;
}

export function formatPortfolio(p: PortfolioState): string {
  const lines: string[] = [
    `Portfolio for ${p.smartAccount}`,
    `Timestamp: ${new Date(p.timestamp).toISOString()}`,
    "",
  ];

  for (const [chainId, chain] of Object.entries(p.chains)) {
    lines.push(`── ${chain.chain} (${chainId}) ──`);
    lines.push(
      `  ETH: ${formatEther(chain.ethBalance)} ETH`
    );

    for (const tb of chain.tokenBalances) {
      if (tb.balance > 0n) {
        // Assume 18 decimals for most, 6 for stablecoins
        const decimals = ["USDC", "USDT", "EURC"].includes(tb.token)
          ? 6
          : 18;
        const formatted = Number(tb.balance) / 10 ** decimals;
        lines.push(`  ${tb.token}: ${formatted.toFixed(decimals === 6 ? 2 : 6)}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}
