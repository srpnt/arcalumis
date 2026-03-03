# Collateral Asset Tracking Strategy

## Problem
Morpho's UI and API don't provide a view of "which vaults/markets are exposed to asset X as collateral." When an asset depegs or becomes toxic, you need to instantly identify all exposure across the protocol.

This is the exact failure mode in the MEV Capital incident — sdeUSD was collateral in multiple markets, and the cascade wasn't visible until it hit.

## What We Need

### 1. Collateral Exposure Map
For every collateral asset used across Morpho:
- Total USD exposure as collateral
- Number of markets using it
- Number of vaults with allocation to those markets
- Breakdown by chain (Ethereum vs Base)
- Concentration risk (what % of a single vault's allocation depends on this collateral)

### 2. Risk Tiers
Classify collateral assets by risk:
- **Tier 1 (Blue Chip):** WETH, WBTC, stETH, wstETH, cbETH — deep liquidity, Chainlink oracle, battle-tested
- **Tier 2 (Established):** USDC, USDT, DAI, FRAX — stablecoins with track record
- **Tier 3 (Emerging):** Newer LSTs, LRTs, wrapped assets — less liquidity, less oracle coverage
- **Tier 4 (Exotic):** sdeUSD, xUSD, small-cap wrapped tokens — thin liquidity, depeg risk, novel mechanisms

### 3. Alert Triggers
- Collateral asset depegs >0.5% from expected value → flag
- Collateral asset depegs >5% → P0 alert with full exposure map
- New market created with Tier 4 collateral → notify
- Vault adds allocation to market with Tier 3/4 collateral → flag
- Collateral asset liquidity drops below threshold → warn

### 4. Data Sources
- **Morpho GraphQL API:** Market data includes `collateralAsset` and `loanAsset`
  - Query: markets with allocation data shows which vaults use which markets
  - Market state shows supply, borrow, utilization per market
- **Arkham Intel:** Entity tracking on large collateral holders
- **DEX Liquidity:** On-chain liquidity depth for each collateral asset
- **Chainlink/Oracle feeds:** Price staleness, deviation monitoring
- **Dune:** Historical liquidation data per collateral type

### 5. Dashboard Integration
New page: `/exposure` or `/collateral`
- Searchable list of all collateral assets across Morpho
- Click an asset → see all markets, vaults, and USD exposure
- Risk tier badge on each asset
- Sparkline showing recent price action
- Liquidity depth indicator
- "What if" tool: "If this asset drops 50%, what's the cascading impact?"

## Implementation Plan

### Phase 1: Data Collection
- Query all Morpho markets, extract unique collateral assets
- For each: total supply, number of markets, number of vaults exposed
- Build collateral → markets → vaults mapping

### Phase 2: Risk Classification
- Auto-classify by market cap, liquidity depth, oracle type
- Manual overrides for known risk assets
- Store classification in memory/config

### Phase 3: Monitoring
- Periodic price checks against oracles and DEX
- Depeg detection with threshold alerts
- New market/allocation monitoring

### Phase 4: Dashboard
- Collateral exposure page in Citadel
- Alert feed integration with Signals page
- "Stress test" simulator

## GraphQL Query for Collateral Mapping
```graphql
query CollateralExposure {
  markets(
    first: 500
    where: { whitelisted: true }
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
  ) {
    items {
      uniqueKey
      loanAsset { address symbol priceUsd }
      collateralAsset { address symbol priceUsd }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
      }
      oracleAddress
      lltv
      morphoBlue { chain { id } }
    }
  }
}
```
