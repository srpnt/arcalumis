/**
 * Fund the smart account's EntryPoint deposit
 * The EntryPoint requires a pre-funded deposit to pay for UserOp gas.
 * We deposit from our EOA directly to the EntryPoint on behalf of the SA.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, mainnet } from "viem/chains";
import { CHAINS, SMART_ACCOUNT, PRIVATE_KEY } from "../shared/config.js";

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
const account = privateKeyToAccount(PRIVATE_KEY);
const VIEM_CHAINS: Record<number, any> = { 1: mainnet, 8453: base };

const depositToAbi = [{
  name: "depositTo",
  type: "function",
  inputs: [{ name: "account", type: "address" }],
  outputs: [],
  stateMutability: "payable",
}] as const;

async function main() {
  const chainId = parseInt(process.argv[2] || "8453");
  const amount = process.argv[3] || "0.003";

  const chainKey = Object.keys(CHAINS).find((k) => CHAINS[k].id === chainId)!;
  const config = CHAINS[chainKey];
  const chain = VIEM_CHAINS[chainId];

  const publicClient = createPublicClient({ chain, transport: http(config.rpcHttp) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcHttp) });

  console.log(`Depositing ${amount} ETH to EntryPoint for ${SMART_ACCOUNT} on chain ${chainId}`);

  // Check EOA balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`EOA balance: ${Number(balance) / 1e18} ETH`);

  const hash = await walletClient.writeContract({
    address: ENTRYPOINT_V07,
    abi: depositToAbi,
    functionName: "depositTo",
    args: [SMART_ACCOUNT],
    value: parseEther(amount),
    chain,
  });

  console.log(`TX: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Deposited. Gas used: ${receipt.gasUsed}`);
}

main().catch(console.error);
