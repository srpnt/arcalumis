/**
 * Nexus Smart Account — Execute Encoding Helpers
 * 
 * Extracted from duplicated code across executor, emergency, test scripts.
 * These encode calldata for the Nexus smart account's execute() function.
 */

import {
  encodeFunctionData,
  encodeAbiParameters,
  type Address,
  type Hex,
} from "viem";

// ============================================================
// Nexus execute ABI
// ============================================================

export const nexusExecuteAbi = [{
  name: "execute",
  type: "function",
  inputs: [
    { name: "mode", type: "bytes32" },
    { name: "executionCalldata", type: "bytes" },
  ],
  outputs: [],
  stateMutability: "payable",
}] as const;

// ============================================================
// Execution mode constants
// ============================================================

export const SINGLE_EXEC_MODE = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
export const BATCH_EXEC_MODE = "0x0100000000000000000000000000000000000000000000000000000000000000" as Hex;

// ============================================================
// Encoding helpers
// ============================================================

/**
 * Encode a single execution for Nexus execute()
 * Format: abi.encodePacked(target, value, calldata) — no length prefix
 */
export function encodeSingleExecution(target: Address, value: bigint, calldata: Hex): Hex {
  const t = target.slice(2).toLowerCase().padStart(40, "0");
  const v = value.toString(16).padStart(64, "0");
  const c = calldata.slice(2);
  return `0x${t}${v}${c}` as Hex;
}

/**
 * Encode a batch execution for Nexus execute()
 * Format: abi.encode(Execution[]) where Execution = (address target, uint256 value, bytes callData)
 */
export function encodeBatchExecution(actions: { target: Address; value: bigint; calldata: Hex }[]): Hex {
  return encodeAbiParameters(
    [{
      type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "callData", type: "bytes" },
      ],
    }],
    [actions.map((a) => ({ target: a.target, value: a.value, callData: a.calldata }))]
  );
}

/**
 * Wrap actions into Nexus execute() calldata.
 * Automatically chooses single vs batch mode based on action count.
 */
export function buildNexusExecuteCalldata(
  actions: { target: Address; value: bigint; calldata: Hex }[]
): Hex {
  if (actions.length === 0) {
    throw new Error("No actions to encode");
  }

  let mode: Hex;
  let executionCalldata: Hex;

  if (actions.length === 1) {
    mode = SINGLE_EXEC_MODE;
    executionCalldata = encodeSingleExecution(actions[0].target, actions[0].value, actions[0].calldata);
  } else {
    mode = BATCH_EXEC_MODE;
    executionCalldata = encodeBatchExecution(actions);
  }

  return encodeFunctionData({
    abi: nexusExecuteAbi,
    functionName: "execute",
    args: [mode, executionCalldata],
  });
}
