# CLAMM — Concentrated Liquidity AMM Knowledge Base

## Core Concept
CLMMs let liquidity providers (LPs) concentrate their capital within specific price ranges, unlike traditional AMMs (Uniswap v2) where liquidity is spread across 0→∞.

### How It Works
- LPs pick a price range [Pa, Pb] to provide liquidity in
- Capital only earns fees when the market price is within that range
- Tighter range = higher capital efficiency, but higher risk of going out-of-range
- When price moves outside your range, you're 100% in one asset (effectively sold the other)

### Math
- Traditional AMM: x * y = k (liquidity spread 0→∞)
- CLAMM: x * y = k but only within [Pa, Pb], so same TVL produces much more liquidity in that range
- Capital efficiency can be 100-4000x better than full-range

### Impermanent Loss (IL) in CLMMs
- **More severe** than traditional AMMs because liquidity is concentrated
- IL is amplified proportionally to how tight the range is
- Going out-of-range = you've been fully converted to the less valuable asset
- Key insight: concentrated LP is essentially selling options (short gamma)

### Key Parameters for Optimization
1. **Range width** — narrow = more fees but more IL risk
2. **Rebalancing frequency** — how often to adjust range as price moves
3. **Pool selection** — fee tier, volume, volatility profile
4. **Position duration** — time in range matters
5. **Gas costs** — frequent rebalancing eats into profits on mainnet

### Strategies
- **Stablecoin pairs** (USDC/USDT): very tight ranges work well, low IL risk
- **Correlated pairs** (ETH/stETH): moderate ranges, low IL
- **Volatile pairs** (ETH/USDC): wider ranges needed, active management required
- **Multi-position**: spread across several ranges at different widths
- **JIT (Just-In-Time) liquidity**: advanced, MEV-adjacent strategy

### IL Mitigation
- Hedging with perps/options (delta-neutral strategies)
- Fee income must exceed IL for profitability
- Wider ranges reduce IL but lower capital efficiency
- Active management (rebalancing) vs passive (set-and-forget wider)

## Platforms

### Uniswap v3/v4
- Pioneer of concentrated liquidity (v3, May 2021)
- v4 adds hooks (custom logic on pools), singleton contract
- Ethereum mainnet, Arbitrum, Optimism, Base, Polygon, etc.

### Aerodrome / Aero (Base chain)
- Leading DEX on Base by volume and fees
- ~$602M TVL as of late 2025
- $238B+ cumulative trading volume
- **Rebranded to "Aero"** (Nov 2025) — merged Aerodrome (Base) + Velodrome (Optimism)
- Slipstream V3: embedded MEV auction in AMM (internalizes arb value)
- METADEX03: dual-engine architecture, routes protocol revenue back to users
- Expanding to Ethereum mainnet Q2 2026
- Developed by Dromos Labs
- AERO token: emissions + fee rewards

### PancakeSwap
- Concentrated liquidity on BSC, Ethereum, Arbitrum, Base, etc.
- v3 launched 2023
- Competitive fee tiers

## Research Papers Worth Noting
- arxiv.org/html/2501.07828v1 — "Automated Market Makers: Toward More Profitable LP Strategies" (Jan 2025)
  - Measurement model based on IL analyzing pool type, position duration, range size, position size
- ScienceDirect (Aug 2025) — "Current Understanding of IL Risk in AMMs"
  - 9 underlying causes of IL risk, most important: price volatility, asset imbalance, risk/return management
  - Mitigation: investment strategies, decentralized tools, pool design, hedging, context strategies

## Key Questions for Our Optimization
- What pairs/pools to target?
- What fee tiers have best volume-to-TVL ratio?
- Automated vs manual rebalancing?
- On-chain execution costs (Base is cheap, mainnet is not)
- How to track and measure performance (IL-adjusted returns)?
