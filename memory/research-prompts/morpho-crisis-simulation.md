# Morpho Crisis Simulation — Research Prompt (Context Only)

**Source:** Ivan's prior research
**Date referenced:** October 10, 2025 (flash crash scenario)
**Purpose:** This prompt was used to generate crisis analysis research. Saved for context, not for execution.

## Dual-Role Framework

### Role Rhino — Morpho Market & Curator Manager
- Internal operational partner for independent risk curators
- Direct lines to curators and internal teams (Solutions Architects, Integration Engineers, Risk, Data, Support)
- Core function: data, trade-offs, and playbooks so curators can act quickly
- Curators own risk decisions. Rhino owns the information supply chain.
- **Defense-oriented:** protocol stability, bad debt containment, curator coordination

### Role Hawk — Independent DeFi Opportunist
- Outside, independent DeFi specialist during crisis
- Goal: profit extraction from adverse conditions
- Identifies: liquidation opportunities, mispriced collateral, depressed vault shares, CEX/DEX arb, discounted debt positions
- Thinks like: searcher, liquidator, sophisticated DeFi trader
- **Offense-oriented:** extraction and opportunity during volatility

## Scenario Parameters
- BTC: sharp 10% wick
- ETH gas: 500+ gwei (extreme)
- Altcoins: down multiples of BTC (cascading liquidations)
- Bad debt event: USDC-denominated Morpho Vault, one underlying market
- Real on-chain data from ~October 10, 2025

## Key Assumptions
- Full knowledge of: DeFi lending mechanics, liquidation flows, oracle design, LTV management
- Full knowledge of: Morpho-specific architecture (Morpho Blue markets, MetaMorpho vaults, curators, supply/borrow caps, market parameters)
- Purpose: stress-test real-time synthesis of market data, on-chain analysis, and operational playbooks under crisis

## Why This Matters for The Citadel
- This dual-role framework (defense + offense) maps directly to our architecture:
  - **Tank** = Rhino-like (monitoring, data supply chain, early warning)
  - **Tank + Trinity** = Hawk-like (identifying and executing on opportunities)
- Crisis scenarios are where the collateral exposure mapping feature becomes critical
- The playbook approach (pre-built responses to scenarios) is something we should build into the system
- Liquidation opportunity detection = future Citadel feature

## Full Task Breakdown

### A) Diagnosis (General)

1. **Metric Review** — Three layers:
   - **Protocol-level (Morpho Blue):** utilization rates, liquidation volumes, oracle price feeds vs DEX spot prices, bad debt accrual per market, total borrows vs available liquidity
   - **Vault-level (MetaMorpho):** vault allocation vs actual exposure, withdrawal queue depth, pending reallocation, share price deviation
   - **External/macro:** CEX-DEX price spreads, gas price & mempool congestion, stablecoin depeg risk, liquidator bot activity, bridge flows

2. **Real-time Monitoring** — Which metrics to watch in real-time during crash, with cadence: block-by-block, minute, 5-min, hourly

3. **Identify Bad Debt Vault** — Use web search to find real USDC Morpho Vault that incurred bad debt:
   - Vault name and curator
   - Specific market (collateral/loan pair)
   - Collateral asset, price action, liquidation parameters (LLTV)
   - Approximate size of bad debt
   - Closest real example if not exactly Oct 10, 2025

### B) Opportunistic Analysis (Role Hawk)

1. **Profit Opportunities** — Top 1-3 concrete opportunities:
   - Trade/action description
   - Expected edge and sizing
   - Execution requirements (capital, gas, contracts, timing)
   - Risks of failure

2. **Morpho-Specific Extraction** — From the bad debt event:
   - Discounted vault shares
   - Liquidation participation
   - Related market positioning

3. **Adversarial Lens for Rhino** — What Hawk would do that Rhino should defend against
   - Feeds into curator recommendations and parameter change urgency

### C) Actions

1. **Incident Timeline:**
   - First 15 min / 60 min / 24 hours
   - Both roles: check, communicate, escalate
   - Tone: urgent but calm, crypto-native

2. **Follow-up 1-2 Weeks Post-Event:**
   - At least 3 things each role tracks
   - Alerting, parameter tracking, thresholds

3. **Bad Debt Handling:**
   - Immediate containment (cap changes, market pause)
   - Loss accounting and socialization mechanics
   - Recovery pursuit (remaining collateral liquidation, governance)
   - Timeline for vault normalization

## Deliverables

### Deliverable 1: One-Page Incident Memo
- Covers both Roles, all action items from A, B, C
- Format for efficiency
