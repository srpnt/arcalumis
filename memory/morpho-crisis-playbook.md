# Morpho Crisis Playbook — Operational Extract

**Source:** Ivan's Rhino/Hawk simulation report (Feb 2026)
**Case Study:** MEV Capital USDC Vault bad debt (Nov 2025)
**PDF:** research/morpho-crisis-simulation-report.pdf

## Case Study: MEV Capital USDC Vault

### What Happened
- MEV Capital USDC Vault accepted sdeUSD (Elixir) and xUSD (Stream Finance) as collateral
- Elixir retired deUSD → sdeUSD lost 99.8% of value → collateral worthless
- Stream Finance xUSD depegged 95% → additional ~$700K bad debt
- Liquidation impossible: no rational liquidator repays USDC to seize worthless sdeUSD

### Damage
| Vault | Address | Haircut |
|-------|---------|---------|
| MEV Capital USDC (ETH) | 0xd63070114470f685b75B74D60EEc7c1113d33a3D | 3.5% |
| MEV Capital USDC (ARB) | 0xa60643c90A542A95026C0F1dbdB0615fF42019Cf | 12% |

### Root Cause Chain
1. 320 curators competing for TVL → race to bottom on collateral quality
2. MEV Capital accepted sdeUSD for higher yields
3. Oracle assumed peg (hardcoded/near 1:1)
4. No mechanism to react to catastrophic depeg
5. Collateral went to zero → bad debt socialized to depositors

### Counter-example: Gauntlet
- Zero bad debt
- Gained 35% TVL (flight-to-quality)
- Processed $42.8M withdrawals (40% of pre-stress TVL)
- Liquidity compression resolved in ~6 hours via IRM rate spike

## Hawk Plays (Opportunity During Crisis)

### Play 1: Liquidation Sniping (Gas Spike)
- When gas > 300 gwei, 80%+ bots offline
- Use Flashbots bundles + flash loans
- Target positions > $100K, HF < 1.0
- Contract: Morpho.liquidate() at 0xBBBBBBBBBB9cc5e90e3b3Af64bdAF62C37EEFFCb
- Est: $15-75K per position
- Kill: other searchers, stale oracles, illiquid collateral

### Play 2: Vault Share Discount
- Post-haircut NAV: ~$0.965/share, panic price: $0.90-0.95
- Buy at 5-15% discount to post-haircut NAV
- Converges in 1-2 weeks
- ERC-4626 secondary market arb: buy DEX at $0.90, redeem on-chain at $0.965
- Est: $5-50K on $100-500K capital
- Kill: additional bad debt, utilization lock

### Play 3: IRM Rate Farming
- Supply USDC directly to Morpho Blue markets (not vaults) at >95% utilization
- IRM pushes rates to 190%+ APR during stress
- ONLY healthy collateral: WETH, WBTC, stETH
- Est: $5-30K/week on $200K-1M
- Kill: insolvency (not illiquidity), fast rate compression

### Play 4: CEX-DEX Arb
- USDe went to $0.65 on Binance vs $1.00 fair → 35% spread
- Requires $500K+ capital, fast execution
- Est: $100-350K
- Kill: DEX liquidity, arb closure

### Play 5: Flight-to-Quality
- Deposit into Gauntlet during chaos → capture +35% TVL wave
- Lower risk, longer horizon
- Est: $25-80K annualized

## Monitoring Framework

### Block-by-Block
- Liquidation events, oracle updates, gas, mempool
- Pending liquidation txs, oracle heartbeat gaps

### Every Minute
- Top 50 position health factors, stablecoin pegs
- CEX-DEX spreads > 2%, HF < 1.02 targets

### Every 5 Minutes
- Vault share price, per-market utilization vs 95%
- Vault share discount to NAV, IRM rate spikes

### Every 15 Minutes
- Vault TVL flows, bridge outflows (L2→L1)
- Funding rate reversals, new vault launches

### Hourly
- Cumulative bad debt, liquidator bot census
- P&L accounting, rate farm APR decay

### Daily
- Governance proposals, curator reallocations
- Next target scan (320 vaults, exotic exposure)

## Protocol-Level Metrics (Crisis)

| Metric | Crisis Threshold |
|--------|-----------------|
| Utilization | >90% crisis, >95% IRM emergency (190%+ APR) |
| Oracle vs DEX spot | >2% divergence = stale, >5% = false liquidations |
| Bad debt per market | Any non-zero = socialization imminent |
| Available liquidity | <10% of supply = freeze risk |
| HF | <1.05 danger, <1.0 liquidatable |
| IRM output rate | >100% APR = emergency mode |
| Gas | >200 gwei = small liquidations unprofitable |
| CEX-DEX spreads | >1% arb, >5% systemic |
| Stablecoin peg | >0.5% depeg review, >5% systemic |

## Adversarial Vectors (Hawk → Rhino Defense)

1. **Oracle heartbeat sniping** — liquidate in same block as oracle update
   - Defense: pull-based oracles (Pyth, Redstone)
2. **Vault share secondary market arb** — buy panic dip on DEX
   - Defense: immediate factual communication, pre-written templates
3. **Weekend curator latency** — crash at 21:15 UTC weekend, 4hr response
   - Defense: automated triggers (>20% drawdown → auto-cap to zero)
4. **Cross-vault correlation scanning** — find curators sharing exotic exposure
   - Defense: transparent market allocation publishing
5. **IRM rate capture** — protocol-aligned, NOT a bug
   - Defense: none needed, structural feature

## Dune SQL Query
- Bad debt event tracker with market context and USD values
- Filters MorphoBlue_evt_Liquidate where badDebtAssets > 0
- Joins with CreateMarket for collateral/loan pairs
- Running cumulative bad debt total
- Full query in PDF source

## Ivan's Incident Report (Rhino-Only Perspective)
**PDF:** research/morpho-case-study-ivan.pdf
**Written as:** internal Morpho Risk report, addressed to Renan & Luciano
**Date:** Feb 23, 2026

### Response Timeline Structure
**First 15 min — Isolate · Quantify · Notify:**
- Confirm curator removed bad markets from supply queues
- Run Dune query for exact badDebtAssets values
- P0 Telegram to curator ops
- Alert internal Risk + Product
- Pause deposit UI if share price hasn't updated (prevent new users entering at stale valuation)
- Confirm no contagion to healthy markets

**First 60 min — Coordinate · Decide · Communicate:**
- Brief Product and Eng
- Discuss Asset Injection feasibility (valid recovery path per Morpho docs)
- Confirm curator stance: inject or socialize?
- Draft depositor comms (factual, numbers-first)
- Oct 10 outcome: socialized loss, off-chain recovery coordination with Elixir/Stream

### Real-Time Priority Dashboard (First 30 min)
1. Oracle feed for affected collateral — stale at $1.00 while spot $0.30 = bad debt accumulates silently
2. badDebtAssets in Liquidate events — any non-zero = confirmed loss
3. convertToAssets(1e18) on vault contract — clearest signal of realized bad debt
4. Withdrawal queue + utilization — >95% util in healthy markets = withdrawals fail, panic compounds

### Internal Stakeholder Routing
- **Product:** protocol behavior confirmation, UI considerations
- **Eng:** oracle freshness verification, front-end updates
- **User Support:** depositor FAQ, loss explanation
- **Executives:** exposure quantification, PR readiness
- **Curators:** actionable recommendations, parameter changes

### Key Detail: Asset Injection
- Valid recovery mechanism per Morpho V1 docs
- Direct supply to market on vault's behalf to restore share price
- Decision: at 3.5% loss, socialization was chosen over injection (moral hazard consideration)
- At <1% loss, injection makes more sense for trust preservation

## Key Takeaway
> "The architecture is sound; the risk management layer is where both defence and exploitation happen."

The protocol worked as designed — market isolation contained blast radius, bad debt socialized per-market. What failed was curation: accepting 99.8%-depegable wrapped stablecoin derivatives as collateral. 320 curators competing for TVL = race to bottom on collateral quality.
