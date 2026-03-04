/**
 * Across Bridge Adapter
 * Encodes bridge calls for Across Protocol V3
 * 
 * Across uses SpokePool contracts on each chain.
 * The relayer network fronts capital on the destination chain.
 * Typical settlement: 1-4 minutes.
 */

import { encodeFunctionData, type Address, type Hex, zeroAddress } from "viem";

// Across V3 SpokePool addresses
export const ACROSS_SPOKE_POOLS: Record<number, Address> = {
  1: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5" as Address, // Ethereum
  8453: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64" as Address, // Base
  42161: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A" as Address, // Arbitrum
  10: "0x6f26Bf09B1C792e3228e5467807a900A503c0281" as Address, // Optimism
};

// Across V3 SpokePool ABI (depositV3)
const spokePoolAbi = [
  {
    name: "depositV3",
    type: "function",
    inputs: [
      { name: "depositor", type: "address" },
      { name: "recipient", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "outputToken", type: "address" },
      { name: "inputAmount", type: "uint256" },
      { name: "outputAmount", type: "uint256" },
      { name: "destinationChainId", type: "uint256" },
      { name: "exclusiveRelayer", type: "address" },
      { name: "quoteTimestamp", type: "uint32" },
      { name: "fillDeadline", type: "uint32" },
      { name: "exclusivityDeadline", type: "uint32" },
      { name: "message", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

// ERC20 approve ABI
const erc20ApproveAbi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export interface BridgeQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  feePct: number;
  quoteTimestamp: number;
  fillDeadline: number;
  estimatedFillTimeSec: number;
}

export interface BridgeAction {
  target: Address;
  calldata: Hex;
  value: bigint;
  description: string;
}

/**
 * Get a bridge quote from the Across API
 */
export async function getAcrossQuote(params: {
  inputToken: Address;
  outputToken: Address;
  originChainId: number;
  destinationChainId: number;
  amount: bigint;
}): Promise<BridgeQuote> {
  const url = new URL("https://app.across.to/api/suggested-fees");
  url.searchParams.set("inputToken", params.inputToken);
  url.searchParams.set("outputToken", params.outputToken);
  url.searchParams.set("originChainId", String(params.originChainId));
  url.searchParams.set("destinationChainId", String(params.destinationChainId));
  url.searchParams.set("amount", params.amount.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Across API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  const totalRelayFee = BigInt(data.totalRelayFee?.total || "0");
  const outputAmount = params.amount - totalRelayFee;
  const feePct = Number(totalRelayFee) / Number(params.amount);
  const quoteTimestamp = Number(data.timestamp || Math.floor(Date.now() / 1000));
  const fillDeadline = quoteTimestamp + 18000; // 5 hours max
  const estimatedFillTimeSec = Number(data.estimatedFillTimeSec || 120);

  return {
    inputAmount: params.amount,
    outputAmount,
    fee: totalRelayFee,
    feePct,
    quoteTimestamp,
    fillDeadline,
    estimatedFillTimeSec,
  };
}

/**
 * Build approve + depositV3 actions for Across bridge
 */
export function buildBridgeActions(params: {
  depositor: Address; // smart account on source chain
  recipient: Address; // smart account on destination chain (same address)
  inputToken: Address;
  outputToken: Address;
  originChainId: number;
  destinationChainId: number;
  quote: BridgeQuote;
  tokenSymbol?: string;
}): BridgeAction[] {
  const spokePool = ACROSS_SPOKE_POOLS[params.originChainId];
  if (!spokePool) {
    throw new Error(`No Across SpokePool for chain ${params.originChainId}`);
  }

  const actions: BridgeAction[] = [];

  // 1. Approve SpokePool to spend input token
  actions.push({
    target: params.inputToken,
    calldata: encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [spokePool, params.quote.inputAmount],
    }),
    value: 0n,
    description: `Approve ${params.tokenSymbol || "token"} to Across SpokePool`,
  });

  // 2. depositV3
  actions.push({
    target: spokePool,
    calldata: encodeFunctionData({
      abi: spokePoolAbi,
      functionName: "depositV3",
      args: [
        params.depositor,
        params.recipient,
        params.inputToken,
        params.outputToken,
        params.quote.inputAmount,
        params.quote.outputAmount,
        BigInt(params.destinationChainId),
        zeroAddress, // no exclusive relayer
        params.quote.quoteTimestamp,
        params.quote.fillDeadline,
        0, // no exclusivity deadline
        "0x", // no message
      ],
    }),
    value: 0n,
    description: `Bridge ${params.tokenSymbol || "token"} via Across: chain ${params.originChainId} → ${params.destinationChainId}`,
  });

  return actions;
}

/**
 * Estimate bridge time based on route
 */
export function estimateBridgeTime(
  originChainId: number,
  destinationChainId: number
): number {
  // Across typical times (seconds)
  // L2 → L2: ~60-120s
  // L1 → L2: ~60-180s
  // L2 → L1: ~60-240s
  const isL1Source = originChainId === 1;
  const isL1Dest = destinationChainId === 1;

  if (isL1Source && !isL1Dest) return 120; // L1 → L2
  if (!isL1Source && isL1Dest) return 180; // L2 → L1
  if (!isL1Source && !isL1Dest) return 90; // L2 → L2
  return 120; // L1 → L1 (shouldn't happen)
}
