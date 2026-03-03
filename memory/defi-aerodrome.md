# Aerodrome / Aero — Knowledge Base

## Overview
Leading DEX on Base chain. Rebranded from Aerodrome to **Aero** in November 2025, merging Aerodrome (Base) + Velodrome (Optimism) into one unified platform.

**Developer:** Dromos Labs (CEO: Alexander Cutler)
**Token:** AERO

## Key Stats (late 2025 / early 2026)
- TVL: ~$602M (entirely on Base)
- Cumulative trading volume: $238B+
- Leading exchange on Base by volume and fees

## Architecture

### Slipstream (Concentrated Liquidity)
- Aerodrome's CLAMM implementation
- Slipstream V2 (Nov 2025) — improved capital efficiency
- **Slipstream V3** — embeds MEV auction directly into AMM
  - Internalizes value typically captured by arb bots
  - Protocol captures MEV instead of external searchers

### METADEX03 (Operating System)
- Dual-engine architecture
- Routes all protocol revenue back to users
- Reduces value leakage

### ve(3,3) Model
- Vote-escrowed tokenomics (inherited from Velodrome/Solidly lineage)
- veAERO holders vote on pool emissions
- Pools receiving more votes → more AERO rewards → attract more liquidity
- Flywheel: fees → votes → emissions → liquidity → volume → fees

## Expansion Plans
- **Ethereum mainnet: Q2 2026** (major catalyst)
- Circle's Arc integration
- Multi-chain ambition — Base as central hub with cross-chain liquidity

## Why It Matters for Our CLAMM Strategy
- Base is cheap (low gas), great for frequent rebalancing
- Highest liquidity/volume on Base = best fee generation potential
- Slipstream V3 MEV capture = better LP returns (less value leakage)
- ve(3,3) emissions = additional yield on top of trading fees
- Pool selection: look for pools with high volume-to-TVL ratio + AERO emissions

## Pool Types on Aerodrome
1. **Stable pools** — for correlated assets (USDC/USDT, ETH/stETH)
2. **Volatile pools** — standard x*y=k for uncorrelated pairs
3. **Concentrated (Slipstream)** — CLAMM pools with custom ranges

## Key Pairs to Monitor
- ETH/USDC (highest volume typically)
- USDC/USDbC
- cbETH/WETH
- AERO/WETH
- Various stablecoin pairs

## Integration Notes
- Base chain (Coinbase L2)
- Standard ERC-20/Uniswap v3-style position NFTs for Slipstream
- Gauge system for staking LP tokens
