# Crosschain Yield Arbitrage — Phase 2 Plan

## Thesis
Same-asset lending rates differ materially across chains (ETH mainnet yields 1.5-2x more than Base for USDC). Today's Yield Comparison page shows this. Phase 2 turns observation into execution.

## What Makes It Arbitrage (Not Just Yield Optimization)

**True arb structure:**
1. Borrow USDC on Base at 3-4% (where rates are low)
2. Bridge to Ethereum mainnet
3. Supply USDC on ETH Morpho at 6-7% (where rates are high)
4. Pocket the 2-3% spread minus costs

**Or simpler (capital reallocation):**
1. Withdraw from low-yield vault on Chain A
2. Bridge to Chain B
3. Deposit in high-yield vault on Chain B
4. Net gain: spread minus bridge cost and gas

## Why Few Players Do This
- Bridge risk (smart contract, liquidity)
- Gas cost on mainnet (~$5-50 per tx depending on gas)
- Rate compression: if enough capital moves, the spread closes
- Timing: rates change, you might arrive after the spread narrowed
- Capital lockup: high utilization on destination chain can trap you

## Implementation Phases

### Phase 2a: Rate Monitoring Engine
**Goal:** Systematically detect and score crosschain yield opportunities

**Build:**
- Scheduled job (cron/heartbeat) that fetches rates across chains every 15 min
- Store snapshots in `data/rate-snapshots/YYYY-MM-DD.json`
- Calculate: same-asset spreads across chains
- Score opportunities by: spread size × liquidity × persistence
- Alert when spread exceeds threshold (configurable, start at 2%)

**Data sources:**
- Morpho GraphQL (ETH + Base) — already built
- Later: Aave (multi-chain), Compound, Spark
- Bridge cost estimates: static initially, later live from bridge APIs

**Dashboard:**
- Evolve Yield Comparison page into opportunity detector
- Add: estimated net gain after costs
- Add: historical spread chart (once we have snapshots)
- Add: "Execute" button (placeholder → real in Phase 2c)

### Phase 2b: Cost Modeling
**Goal:** Know the exact cost of moving capital between chains

**Factors to model:**
1. Bridge fee (Base→ETH: ~$0.10-5 via official bridge, ~$1-10 via fast bridges)
2. Gas on destination chain (mainnet: variable, Base: negligible)
3. Slippage on large movements
4. Time cost (official bridge: 7 days, fast bridge: minutes)
5. Smart contract risk premium

**Build:**
- Bridge cost estimator: query bridge APIs (Across, Stargate, official Base bridge)
- Gas estimator: use live gas price (already on dashboard)
- Net spread calculator: gross spread - all costs = net annual gain
- Break-even analysis: minimum capital for the arb to be profitable
- Add to Yield Comparison page ROI calculator

### Phase 2c: Execution Layer
**Goal:** Semi-automated capital movement

**Build (Trinity):**
- Script/bot that:
  1. Monitors for opportunities above threshold
  2. Calculates optimal bridge route and cost
  3. Generates the transaction calldata
  4. Presents for human approval (initially)
  5. Executes on approval
  
- Required: wallet with private keys (Ivan provides when ready)
- Chains: ETH mainnet + Base initially
- Protocols: Morpho only initially, expand later

**Safety:**
- Human approval required for all trades initially
- Max position size limit
- Automatic exit if spread compresses below cost
- Monitoring: Track all positions, P&L, exposure

### Phase 2d: Multi-Protocol Expansion
**Goal:** Not just Morpho-to-Morpho, but cross-protocol

**Expand monitoring to:**
- Aave V3 (ETH, Base, Arbitrum, Optimism)
- Compound III (ETH, Base)
- Spark (ETH)
- Later: Euler, Venus, etc.

**This multiplies the opportunity space:**
- Borrow on Aave Base → Supply on Morpho ETH
- Borrow on Morpho Base → Supply on Aave ETH
- Any combination across protocols and chains

## Timeline
- **Phase 2a** (next): Rate monitoring + snapshots + alerts — 1-2 sessions
- **Phase 2b** (then): Cost modeling + net spread calculator — 1 session
- **Phase 2c** (after dappnode): Execution script — 2-3 sessions
- **Phase 2d** (later): Multi-protocol expansion — ongoing

## Risk Framework
| Risk | Mitigation |
|------|-----------|
| Bridge hack | Use established bridges only, limit max per-bridge exposure |
| Rate compression | Exit if net spread < 0.5% |
| Smart contract risk | Morpho Blue is audited, immutable core |
| Gas spike on exit | Factor gas cost into entry decision, maintain exit reserves |
| Capital lockup | Monitor utilization at destination before entry |
| Oracle failure | Monitor oracle freshness (from crisis playbook) |

## Success Metrics
- Net annualized spread captured (after all costs)
- Capital efficiency: return per dollar deployed
- Win rate: % of trades that remain profitable
- Time-to-execute: from signal to position
