/**
 * Deploy Nexus Smart Account on Ethereum and Base
 * 
 * Uses the existing Biconomy MEE v2.2.1 infrastructure:
 * - NexusAccountFactory to create the account
 * - K1 MEE Validator as the default validator (our EOA as owner)
 * - Composable Execution Module as executor
 * 
 * The account will have the SAME address on both chains (deterministic via CREATE2).
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  concat,
  pad,
  type Hex,
  type Address,
  encodePacked,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

// ============================================================
// Configuration
// ============================================================

const CREDENTIALS_DIR = join(process.env.HOME || "/home/piton", ".openclaw/workspace/credentials");

// Load secrets
const rpcConfig = JSON.parse(readFileSync(join(CREDENTIALS_DIR, "rpc-config.json"), "utf-8"));
const privateKey = readFileSync(join(CREDENTIALS_DIR, "wallet.key"), "utf-8").trim() as Hex;

// MEE v2.2.1 contract addresses (same on all chains)
const CONTRACTS = {
  nexusImpl: "0x0000000020fe2F30453074aD916eDeB653eC7E9D" as Address,
  k1MeeValidator: "0x0000000002d3cC5642A748B6783F32C032616E03" as Address,
  nexusBootstrap: "0x000000007BfEdA33ac982cb38eAaEf5D7bCC954c" as Address,
  nexusFactory: "0x000000002c9A405a196f2dc766F2476B731693c3" as Address,
  composableExecModule: "0x00000000f61636C0CA71d21a004318502283aB2d" as Address,
  composableStorage: "0x0000000078994c6ef6A4596BE53A728b255352c2" as Address,
};

// ============================================================
// ABIs (minimal)
// ============================================================

const factoryAbi = [
  {
    name: "createAccount",
    type: "function",
    inputs: [
      { name: "initData", type: "bytes" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "payable",
  },
  {
    name: "computeAccountAddress",
    type: "function",
    inputs: [
      { name: "initData", type: "bytes" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "expectedAddress", type: "address" }],
    stateMutability: "view",
  },
] as const;

// Bootstrap: initNexusWithDefaultValidatorAndOtherModules
const bootstrapAbi = [
  {
    name: "initNexusWithDefaultValidatorAndOtherModules",
    type: "function",
    inputs: [
      { name: "defaultValidatorInitData", type: "bytes" },
      {
        name: "validators",
        type: "tuple[]",
        components: [
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
      {
        name: "executors",
        type: "tuple[]",
        components: [
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
      {
        name: "hook",
        type: "tuple",
        components: [
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
      {
        name: "fallbacks",
        type: "tuple[]",
        components: [
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
      {
        name: "preValidationHooks",
        type: "tuple[]",
        components: [
          { name: "hookType", type: "uint256" },
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

// ============================================================
// Main
// ============================================================

async function main() {
  const account = privateKeyToAccount(privateKey);
  console.log("EOA Address:", account.address);
  console.log("");

  // The K1 MEE Validator expects the owner as raw bytes20 (just the address, no ABI padding)
  const validatorInitData = account.address.toLowerCase() as Hex;

  // Composable Execution Module — init data (empty for basic setup)
  const composableInitData = "0x" as Hex;

  // Encode the bootstrap call: delegatecall to NexusBootstrap
  const bootstrapCalldata = encodeFunctionData({
    abi: bootstrapAbi,
    functionName: "initNexusWithDefaultValidatorAndOtherModules",
    args: [
      validatorInitData, // default validator init (K1 MEE Validator with our EOA)
      [],                // additional validators (none)
      [                  // executors
        {
          module: CONTRACTS.composableExecModule,
          data: composableInitData,
        },
      ],
      {                  // hook (none)
        module: "0x0000000000000000000000000000000000000000" as Address,
        data: "0x" as Hex,
      },
      [],                // fallbacks (none)
      [],                // preValidationHooks (none)
    ],
  });

  // The factory initData = abi.encode(bootstrapAddress, bootstrapCalldata)
  const initData = encodeAbiParameters(
    parseAbiParameters("address, bytes"),
    [CONTRACTS.nexusBootstrap, bootstrapCalldata]
  );

  // Salt — unique per deployment. Using keccak of our EOA + a nonce
  const salt = keccak256(
    encodePacked(["address", "uint256"], [account.address, 0n])
  );

  console.log("Salt:", salt);
  console.log("Init data length:", initData.length, "bytes");
  console.log("");

  // ============================================================
  // Compute expected address (should be same on both chains)
  // ============================================================

  const chains = [
    { name: "Base", chain: base, rpc: rpcConfig.base.http },
    { name: "Ethereum", chain: mainnet, rpc: rpcConfig.ethereum.http },
  ];

  for (const { name, chain, rpc } of chains) {
    const publicClient = createPublicClient({
      chain,
      transport: http(rpc),
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpc),
    });

    // Compute expected address
    const expectedAddress = await publicClient.readContract({
      address: CONTRACTS.nexusFactory,
      abi: factoryAbi,
      functionName: "computeAccountAddress",
      args: [initData, salt],
    });

    console.log(`${name}: Expected smart account address: ${expectedAddress}`);

    // Check if already deployed
    const code = await publicClient.getCode({ address: expectedAddress as Address });
    if (code && code.length > 4) {
      console.log(`${name}: ✅ Account already deployed at ${expectedAddress}`);
      continue;
    }

    // Check EOA balance for gas
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`${name}: EOA balance: ${Number(balance) / 1e18} ETH`);

    if (balance === 0n) {
      console.log(`${name}: ⚠️ No gas available, skipping deployment`);
      continue;
    }

    // Deploy!
    console.log(`${name}: Deploying smart account...`);
    try {
      const hash = await walletClient.writeContract({
        address: CONTRACTS.nexusFactory,
        abi: factoryAbi,
        functionName: "createAccount",
        args: [initData, salt],
      });

      console.log(`${name}: TX submitted: ${hash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`${name}: ✅ Deployed! Gas used: ${receipt.gasUsed}. Status: ${receipt.status}`);
    } catch (err: any) {
      console.error(`${name}: ❌ Deployment failed:`, err.message?.slice(0, 200));
    }

    console.log("");
  }
}

main().catch(console.error);
