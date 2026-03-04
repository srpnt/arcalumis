# Execution Infrastructure — Scope Document
## Date: 2026-03-04

## Purpose
Build a cross-chain execution layer that enables single-signature multi-chain DeFi operations. First use case: cross-chain position management on Morpho. Future: DEX-to-DEX arb, any cross-chain workflow.

## Architecture

```
┌─────────────────────────────────────┐
│           NODE (TypeScript/Bun)      │
│                                      │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ Watcher  │  │    Planner       │ │
│  │          │→ │                  │ │
│  │ Monitor  │  │ Build execution  │ │
│  │ rates,   │  │ plan (Stx),     │ │
│  │ pools,   │  │ simulate,       │ │
│  │ balances │  │ sign merkle root│ │
│  └──────────┘  └────────┬─────────┘ │
│                          │           │
│               ┌──────────▼─────────┐ │
│               │    Executor        │ │
│               │                    │ │
│               │ Submit to smart    │ │
│               │ accounts per chain,│ │
│               │ monitor receipts,  │ │
│               │ handle failures    │ │
│               └────────────────────┘ │
└─────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Ethereum │ │   Base   │ │ Arbitrum │
│          │ │          │ │          │
│ ERC-7579 │ │ ERC-7579 │ │ ERC-7579 │
│ Smart    │ │ Smart    │ │ Smart    │
│ Account  │ │ Account  │ │ Account  │
│ (same    │ │ (same    │ │ (same    │
│  addr)   │ │  addr)   │ │  addr)   │
│          │ │          │ │          │
│ Modules: │ │ Modules: │ │ Modules: │
│ -K1 MEE  │ │ -K1 MEE  │ │ -K1 MEE  │
│  Validator│ │  Validator│ │  Validator│
│ -Composbl│ │ -Composbl│ │ -Composbl│
│  Executor│ │  Executor│ │  Executor│
└──────────┘ └──────────┘ └──────────┘
```

## Components

### 1. Smart Account Layer (On-Chain)

**What:** ERC-7579 smart account (Nexus) deployed at same address on all target chains via CREATE2.

**Modules installed:**
- K1 MEE Validator — validates SuperTransactions (merkle tree of operations, temporal constraints, single-signature authorization)
- Composable Execution Module — runtime parameter injection (`runtimeERC20BalanceOf`), output-to-input chaining, constraint validation

**Source:** Fork from `bcnmy/stx-contracts` (audited, production-tested)

**Deployment targets (Phase 1):** Ethereum, Base
**Phase 2:** Arbitrum, Optimism

**Work required:**
- [ ] Fork stx-contracts, review code
- [ ] Deploy Nexus factory to target chains
- [ ] Deploy smart account via factory (deterministic address)
- [ ] Install K1 MEE Validator module
- [ ] Install Composable Execution module
- [ ] Verify all modules work on both chains
- [ ] Fund accounts with gas + initial capital

### 2. Node — Watcher Module

**What:** Monitors on-chain state across all target chains.

**Monitors:**
- Morpho market rates (supply APY, borrow APY, utilization, liquidity)
- Smart account balances per chain (all relevant tokens)
- Gas prices per chain
- Bridge status (Across relayer availability, fees)
- Position health (collateral value, health factor if positions are open)

**Data sources:**
- Morpho GraphQL API (bulk rate data, 5-min refresh)
- RPC nodes via viem (real-time balance queries, event listening)
- Across API (bridge quotes, relayer status)
- CoinGecko/Binance API (price feeds for collateral valuation)

**Output:** Structured state object representing current cross-chain portfolio + market conditions.

**Work required:**
- [ ] Set up viem clients per chain (Ethereum, Base)
- [ ] Morpho SDK integration (`@morpho-org/blue-sdk-viem`)
- [ ] Balance polling per chain
- [ ] Rate monitoring with configurable thresholds
- [ ] State aggregation into unified portfolio view

### 3. Node — Planner Module

**What:** Takes current state from Watcher, decides if action is needed, constructs execution plans.

**Decision logic:**
- Rate differential exceeds threshold → rebalance
- Utilization spike on supply side → consider exit
- Better rate available on different chain → move capital
- Health factor approaching liquidation → add collateral or exit
- Manual trigger via dashboard (future)

**Execution plan construction:**
- Determine action sequence per chain (withdraw → bridge → supply, etc.)
- Encode each action as Morpho SDK bundle (`@morpho-org/bundler-sdk-viem`)
- Build SuperTransaction (merkle tree of per-chain UserOps)
- Simulate each chain's batch via `eth_call` against live state
- Calculate total gas cost + bridge cost
- If net benefit > costs → proceed; else → skip

**Output:** Signed SuperTransaction (merkle root signed by EOA, per-chain proofs + calldata ready to submit).

**Work required:**
- [ ] Morpho bundler SDK integration (supply/withdraw/borrow/repay encoding)
- [ ] Across bridge calldata encoding (depositV3)
- [ ] SuperTransaction construction (following stx-contracts patterns)
- [ ] Simulation pipeline (eth_call per chain)
- [ ] Cost/benefit calculation
- [ ] EOA signing integration

### 4. Node — Executor Module

**What:** Submits signed SuperTransaction to smart accounts on each chain, monitors outcomes.

**Flow:**
1. Submit source chain tx (e.g., withdraw + bridge)
2. Monitor bridge completion (poll destination chain for balance arrival)
3. When constraint satisfied (balance arrived), submit destination chain tx
4. Monitor receipt, verify success
5. Update portfolio state
6. If any step fails: trigger unwind logic

**Constraint-based retry (from Biconomy pattern):**
- Destination chain actions have constraints (`balance >= X`)
- Executor polls until constraint is met, then submits
- Timeout: if constraint not met within deadline, abort

**Failure handling:**
- Source chain tx reverts → no funds moved, safe
- Bridge stuck → funds in transit, monitor bridge status, alert
- Destination chain tx reverts → funds on destination but not deployed, retry or manual intervention
- Emergency: sweep all funds to safe address across all chains

**Work required:**
- [ ] Transaction submission via viem
- [ ] Receipt monitoring + confirmation
- [ ] Bridge completion detection (balance polling on destination)
- [ ] Constraint-based retry loop
- [ ] Timeout + abort logic
- [ ] Emergency sweep function
- [ ] Event logging for dashboard consumption

### 5. Bridge Adapter

**What:** Abstracts bridge interactions behind a consistent interface.

**Phase 1:** Across only (direct contract integration)
**Phase 2:** Stargate, native bridges for rebalancing

**Across integration:**
- Quote API: `GET /api/suggested-fees` for fee estimation
- Execution: `depositV3` on SpokePool contract
- Monitoring: poll destination for `FilledV3Relay` event or balance change

**Interface:**
```typescript
interface BridgeAdapter {
  quote(params: BridgeQuoteParams): Promise<BridgeQuote>;
  buildCalldata(params: BridgeExecParams): Promise<EncodedCall>;
  estimateTime(srcChain: number, dstChain: number): number;
}
```

**Work required:**
- [ ] Across SpokePool addresses per chain
- [ ] Quote API integration
- [ ] Calldata encoding for depositV3
- [ ] Fee estimation + slippage calculation

### 6. Dashboard Integration (Future)

Not blocking for v1, but designed for:
- Top opportunities on main page (wired to Watcher)
- Position view in sidebar (wired to Executor state)
- Manual trigger buttons ("Rebalance to Base", "Exit all")
- Transaction history + P&L tracking

## Dependencies (from Ivan)

- [ ] Funded wallets (ETH on Ethereum + Base for gas, plus capital)
- [ ] Private key (file drop to /tmp, not chat)
- [ ] RPC endpoints (Ethereum + Base, WebSocket preferred)
  - Recommended: Alchemy, QuickNode, or Infura (paid tier)
  - Dappnode works for Ethereum if ports are exposed
- [ ] Existing code/contracts repo for audit

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Node runtime | TypeScript on Bun |
| Chain interaction | viem |
| Morpho integration | @morpho-org/blue-sdk-viem, bundler-sdk-viem, simulation-sdk |
| Smart account | Nexus (ERC-7579) from stx-contracts |
| Module dev/test | Rhinestone ModuleKit + Foundry |
| Bridge | Across Protocol SDK + direct contract calls |
| Job queue | BullMQ on Redis (if needed) or simple event loop |
| Contract audit | Trail of Bits skills (building-secure-contracts) |
| Config | .env files, same pattern as Citadel |

## Phases

### Phase 0: Foundation (current)
- [x] Research complete
- [x] Architecture scoped
- [x] Dashboard operational
- [ ] RPCs + wallet from Ivan

### Phase 1: Smart Account Deployment
- Fork + review stx-contracts
- Deploy Nexus + modules to Ethereum + Base
- Verify functionality
- Fund accounts

### Phase 2: Node — Read Path
- Watcher: monitor Morpho rates + balances
- Connect to dashboard for live data
- Paper trade mode: log what actions would be taken

### Phase 3: Node — Write Path
- Planner: construct SuperTransactions
- Executor: submit + monitor
- Bridge adapter: Across integration
- First live tx: small ($100) test rebalance

### Phase 4: Operational
- Scale capital deployment
- Add more chains (Arbitrum, Optimism)
- Emergency procedures tested
- Dashboard integration (positions, P&L)

### Phase 5: Expansion
- DEX-to-DEX price arb (higher frequency, higher volume)
- Additional bridges (Stargate)
- Multi-protocol (Aave, Compound alongside Morpho)
- Automated rebalancing triggers
