/**
 * Citadel Node Configuration
 * Loads RPCs, keys, contract addresses from credentials
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Address, Hex } from "viem";

const CREDENTIALS_DIR = join(
  process.env.HOME || "/home/piton",
  ".openclaw/workspace/credentials"
);

// Load RPC config
const rpcConfig = JSON.parse(
  readFileSync(join(CREDENTIALS_DIR, "rpc-config.json"), "utf-8")
);

// Load wallet key
const privateKey = readFileSync(
  join(CREDENTIALS_DIR, "wallet.key"),
  "utf-8"
).trim() as Hex;

// MEE v2.2.1 contract addresses (same on all chains)
export const CONTRACTS = {
  nexusImpl: "0x0000000020fe2F30453074aD916eDeB653eC7E9D" as Address,
  k1MeeValidator: "0x0000000002d3cC5642A748B6783F32C032616E03" as Address,
  nexusBootstrap: "0x000000007BfEdA33ac982cb38eAaEf5D7bCC954c" as Address,
  nexusFactory: "0x000000002c9A405a196f2dc766F2476B731693c3" as Address,
  composableExecModule:
    "0x00000000f61636C0CA71d21a004318502283aB2d" as Address,
  composableStorage:
    "0x0000000078994c6ef6A4596BE53A728b255352c2" as Address,
} as const;

// Our smart account (same address on all chains)
export const SMART_ACCOUNT =
  "0x21143020252B895c97f0adDCeC6218b927c533B3" as Address;

// Chain configuration
export interface ChainConfig {
  id: number;
  name: string;
  rpcHttp: string;
  rpcWs: string;
}

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: "Ethereum",
    rpcHttp: rpcConfig.ethereum.http,
    rpcWs: rpcConfig.ethereum.ws,
  },
  base: {
    id: 8453,
    name: "Base",
    rpcHttp: rpcConfig.base.http,
    rpcWs: rpcConfig.base.ws,
  },
};

// Morpho Blue addresses per chain
export const MORPHO_BLUE: Record<number, Address> = {
  1: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address, // Ethereum
  8453: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address, // Base (same address)
};

// Key token addresses
export const TOKENS: Record<
  string,
  Record<number, Address>
> = {
  USDC: {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  },
  WETH: {
    1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
    8453: "0x4200000000000000000000000000000000000006" as Address,
  },
  EURC: {
    1: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c" as Address,
    8453: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as Address,
  },
};

export const PRIVATE_KEY = privateKey;

export default {
  CONTRACTS,
  SMART_ACCOUNT,
  CHAINS,
  MORPHO_BLUE,
  TOKENS,
  PRIVATE_KEY,
};
