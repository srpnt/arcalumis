/**
 * Morpho Blue Adapter
 * Encodes supply, withdraw, borrow, repay, supplyCollateral, withdrawCollateral calls
 * 
 * Reference: morpho-org/morpho-blue-snippets
 * Morpho Blue has the same address on all EVM chains: 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import { MORPHO_BLUE } from "../config/index.js";

// Morpho Blue ABI (minimal — just what we need)
const morphoBlueAbi = [
  {
    name: "supply",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "assetsSupplied", type: "uint256" },
      { name: "sharesSupplied", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "assetsWithdrawn", type: "uint256" },
      { name: "sharesWithdrawn", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "borrow",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "assetsBorrowed", type: "uint256" },
      { name: "sharesBorrowed", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "repay",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "assetsRepaid", type: "uint256" },
      { name: "sharesRepaid", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "supplyCollateral",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "withdrawCollateral",
    type: "function",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
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

export interface MarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

export interface MorphoAction {
  target: Address;
  calldata: Hex;
  value: bigint;
  description: string;
}

/**
 * Build an ERC20 approve action
 */
export function buildApprove(
  tokenAddress: Address,
  spender: Address,
  amount: bigint,
  chainId: number,
  tokenSymbol: string = "token"
): MorphoAction {
  return {
    target: tokenAddress,
    calldata: encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [spender, amount],
    }),
    value: 0n,
    description: `Approve ${tokenSymbol} to Morpho Blue on chain ${chainId}`,
  };
}

/**
 * Build a Morpho supply action (lend assets to earn yield)
 */
export function buildSupply(
  marketParams: MarketParams,
  amount: bigint,
  onBehalf: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "supply",
      args: [marketParams, amount, 0n, onBehalf, "0x"],
    }),
    value: 0n,
    description: `Supply ${assetSymbol} to Morpho market on chain ${chainId}`,
  };
}

/**
 * Build a Morpho withdraw action
 */
export function buildWithdraw(
  marketParams: MarketParams,
  amount: bigint, // 0 = withdraw all (use shares instead)
  shares: bigint,
  onBehalf: Address,
  receiver: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "withdraw",
      args: [marketParams, amount, shares, onBehalf, receiver],
    }),
    value: 0n,
    description: `Withdraw ${assetSymbol} from Morpho market on chain ${chainId}`,
  };
}

/**
 * Build a Morpho supplyCollateral action
 */
export function buildSupplyCollateral(
  marketParams: MarketParams,
  amount: bigint,
  onBehalf: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "supplyCollateral",
      args: [marketParams, amount, onBehalf, "0x"],
    }),
    value: 0n,
    description: `Supply ${assetSymbol} as collateral on chain ${chainId}`,
  };
}

/**
 * Build a Morpho borrow action
 */
export function buildBorrow(
  marketParams: MarketParams,
  amount: bigint,
  onBehalf: Address,
  receiver: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "borrow",
      args: [marketParams, amount, 0n, onBehalf, receiver],
    }),
    value: 0n,
    description: `Borrow ${assetSymbol} from Morpho market on chain ${chainId}`,
  };
}

/**
 * Build a Morpho repay action
 */
export function buildRepay(
  marketParams: MarketParams,
  amount: bigint, // 0 = repay all (use shares)
  shares: bigint,
  onBehalf: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "repay",
      args: [marketParams, amount, shares, onBehalf, "0x"],
    }),
    value: 0n,
    description: `Repay ${assetSymbol} to Morpho market on chain ${chainId}`,
  };
}

/**
 * Build a Morpho withdrawCollateral action
 */
export function buildWithdrawCollateral(
  marketParams: MarketParams,
  amount: bigint,
  onBehalf: Address,
  receiver: Address,
  chainId: number,
  assetSymbol: string = "token"
): MorphoAction {
  return {
    target: MORPHO_BLUE[chainId],
    calldata: encodeFunctionData({
      abi: morphoBlueAbi,
      functionName: "withdrawCollateral",
      args: [marketParams, amount, onBehalf, receiver],
    }),
    value: 0n,
    description: `Withdraw ${assetSymbol} collateral from Morpho on chain ${chainId}`,
  };
}
