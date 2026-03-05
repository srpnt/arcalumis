/**
 * ERC-4337 UserOperation Builder
 * 
 * Builds, signs, and submits UserOperations to the EntryPoint v0.7.
 * Uses the NoMeeFlow validation path (standard ECDSA signature on userOpHash).
 * 
 * EntryPoint v0.7 uses PackedUserOperation format.
 * 
 * ⚠️  BATTLE-TESTED — Live tx on Base. Do not break this.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  concat,
  pad,
  toHex,
  toBytes,
  type Address,
  type Hex,
  encodePacked,
  hexToBigInt,
} from "viem";
import { privateKeyToAccount, signMessage } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { CHAINS, SMART_ACCOUNT, PRIVATE_KEY, CONTRACTS } from "./config.js";

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };
const account = privateKeyToAccount(PRIVATE_KEY);

// ============================================================
// Packed UserOperation (ERC-4337 v0.7)
// ============================================================

export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex; // packed: bytes16(verificationGasLimit) + bytes16(callGasLimit)
  preVerificationGas: bigint;
  gasFees: Hex; // packed: bytes16(maxPriorityFeePerGas) + bytes16(maxFeePerGas)
  paymasterAndData: Hex;
  signature: Hex;
}

// ============================================================
// EntryPoint v0.7 ABI (minimal)
// ============================================================

const entryPointAbi = [
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getNonce",
    type: "function",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getUserOpHash",
    type: "function",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

// ============================================================
// Helpers
// ============================================================

function packGasLimits(verificationGasLimit: bigint, callGasLimit: bigint): Hex {
  const vgl = verificationGasLimit.toString(16).padStart(32, "0");
  const cgl = callGasLimit.toString(16).padStart(32, "0");
  return `0x${vgl}${cgl}` as Hex;
}

function packGasFees(maxPriorityFeePerGas: bigint, maxFeePerGas: bigint): Hex {
  const mpfpg = maxPriorityFeePerGas.toString(16).padStart(32, "0");
  const mfpg = maxFeePerGas.toString(16).padStart(32, "0");
  return `0x${mpfpg}${mfpg}` as Hex;
}

function getClients(chainId: number) {
  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  return {
    public: createPublicClient({ chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) }),
    wallet: createWalletClient({ account, chain: VIEM_CHAINS[chainId], transport: http(config.rpcHttp) }),
  };
}

// ============================================================
// Nonce key encoding for K1 MEE Validator
// The nonce key encodes: validationMode (1 byte) + validator address (20 bytes) 
// packed into uint192 as the EntryPoint nonce key
// For NoMEE flow (standard), the mode byte is 0x00
// ============================================================

function getNonceKey(): bigint {
  // K1 MEE Validator is the default validator (installed at bootstrap)
  // Default validator = address(0) in nonce = nonce key 0
  // Nonce structure: [3 bytes empty][1 byte mode=0x00][20 bytes validator=0x00][8 bytes seq]
  return 0n;
}

// ============================================================
// Main functions
// ============================================================

/**
 * Get the smart account's nonce for our validator
 */
export async function getAccountNonce(chainId: number): Promise<bigint> {
  const clients = getClients(chainId);
  const nonceKey = getNonceKey();

  return clients.public.readContract({
    address: ENTRYPOINT_V07,
    abi: entryPointAbi,
    functionName: "getNonce",
    args: [SMART_ACCOUNT, nonceKey],
  });
}

/**
 * Build a UserOperation for executing actions through the smart account
 */
export async function buildUserOp(
  chainId: number,
  executeCalldata: Hex,
): Promise<PackedUserOperation> {
  const clients = getClients(chainId);
  const nonce = await getAccountNonce(chainId);

  // Get current gas prices
  const block = await clients.public.getBlock({ blockTag: "latest" });
  const baseFee = block.baseFeePerGas || 1000000000n;
  const maxPriorityFeePerGas = chainId === 1 ? 2000000000n : 100000n; // 2 gwei mainnet, 0.1 gwei L2
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;

  // Gas limits (conservative estimates)
  const verificationGasLimit = 500000n;
  const callGasLimit = 1000000n;
  const preVerificationGas = 100000n;

  return {
    sender: SMART_ACCOUNT,
    nonce,
    initCode: "0x" as Hex, // Account already deployed
    callData: executeCalldata,
    accountGasLimits: packGasLimits(verificationGasLimit, callGasLimit),
    preVerificationGas,
    gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
    paymasterAndData: "0x" as Hex, // No paymaster, account pays gas
    signature: "0x" as Hex, // Placeholder, will be filled after signing
  };
}

/**
 * Sign a UserOperation using the K1 MEE Validator (NoMEE flow)
 * The signature is a standard ECDSA signature over the userOpHash
 */
export async function signUserOp(
  chainId: number,
  userOp: PackedUserOperation,
): Promise<PackedUserOperation> {
  const clients = getClients(chainId);

  // Get userOpHash from EntryPoint
  const userOpHash = await clients.public.readContract({
    address: ENTRYPOINT_V07,
    abi: entryPointAbi,
    functionName: "getUserOpHash",
    args: [userOp],
  });

  console.log(`    UserOp hash: ${userOpHash}`);

  // Sign with our EOA (NoMEE flow: raw ECDSA signature, no prefix)
  const signature = await account.signMessage({
    message: { raw: toBytes(userOpHash) },
  });

  return { ...userOp, signature };
}

/**
 * Submit a signed UserOperation to the EntryPoint
 */
export async function submitUserOp(
  chainId: number,
  userOp: PackedUserOperation,
): Promise<{ txHash: Hex; success: boolean; gasUsed: bigint; error?: string }> {
  const clients = getClients(chainId);

  console.log(`    📤 Submitting UserOp to EntryPoint...`);

  try {
    const hash = await clients.wallet.writeContract({
      address: ENTRYPOINT_V07,
      abi: entryPointAbi,
      functionName: "handleOps",
      args: [[userOp], account.address], // beneficiary = our EOA (receives gas refund)
      chain: VIEM_CHAINS[chainId],
    });

    console.log(`    🔗 TX: ${hash}`);

    const receipt = await clients.public.waitForTransactionReceipt({
      hash,
      timeout: 120_000,
    });

    const success = receipt.status === "success";
    console.log(`    ${success ? "✅" : "❌"} ${success ? "Confirmed" : "Reverted"} | Gas: ${receipt.gasUsed}`);

    return { txHash: hash, success, gasUsed: receipt.gasUsed };
  } catch (err: any) {
    const msg = err.shortMessage?.slice(0, 300) || err.message?.slice(0, 300);
    console.error(`    ❌ Submit failed: ${msg}`);
    return { txHash: "0x" as Hex, success: false, gasUsed: 0n, error: msg };
  }
}

/**
 * Full flow: build + sign + submit a UserOp
 */
export async function executeViaUserOp(
  chainId: number,
  executeCalldata: Hex,
  options: { dryRun?: boolean } = {},
): Promise<{ txHash: Hex; success: boolean; gasUsed: bigint; error?: string }> {
  const chainName = CHAINS[Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!].name;
  console.log(`\n  🔗 ${chainName} — Building UserOp...`);

  // Build
  const userOp = await buildUserOp(chainId, executeCalldata);
  console.log(`    Nonce: ${userOp.nonce}`);

  // Sign
  const signedUserOp = await signUserOp(chainId, userOp);
  console.log(`    Signature: ${signedUserOp.signature.slice(0, 20)}...`);

  if (options.dryRun) {
    console.log(`    📝 Dry run — not submitting`);
    return { txHash: "0x" as Hex, success: true, gasUsed: 0n };
  }

  // Submit
  return submitUserOp(chainId, signedUserOp);
}
