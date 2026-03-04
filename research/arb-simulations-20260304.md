# Cross-Chain Arbitrage Simulations — 2026-03-04

## Methodology
Pulled live data from Morpho GraphQL API via Citadel's /api/arbitrage endpoint. Simulated execution flows for opportunities across risk profiles.

## Key Finding
Most high-spread opportunities (10%+) are untradeable due to:
- Zero liquidity (100% utilization)
- Exotic collateral (Tier 4)
- Immature bridge infrastructure (Monad, Katana, Unichain)
- Reward dependency (spreads evaporate when incentives end)

Real, executable opportunities live in the 2-6% range on established assets between Ethereum↔Base.

## Simulated Opportunities

### High Spread, Positive Borrow
| Asset | Spread | Chains | Risk | Verdict |
|-------|--------|--------|------|---------|
| eUSD | 12.47% | ETH↔Base | 2/10 | Untradeable (96% util, $0 liquidity) — MONITOR |
| USDT0 | 9.47% | Monad↔Polygon | 7/10 | Skip (Monad bridge uncertain, 83% reward-dep) |

### Negative Borrow (Reward-Subsidized)
| Asset | Spread | Chains | Risk | Verdict |
|-------|--------|--------|------|---------|
| USDC | 30.52% | OP↔ETH | 4/10 | Untradeable (0% liquidity, 72% reward-dep) |
| AUSD | 10.11% | ETH↔Monad | 7.5/10 | Skip (0% liquidity, exotic collateral, young) |
| WETH | 5.98% | Base↔ETH | 4.5/10 | Viable $5-10K (58% reward-dep, mature 510d) |
| WETH | 3.44% | Unichain↔Monad | 6/10 | Farm only (100% reward-dep, negative organic) |

### Low Risk (score ≤ 3) ⭐
| Asset | Spread | Chains | Risk | Deployable | Monthly Net | Verdict |
|-------|--------|--------|------|------------|-------------|---------|
| eUSD | 12.47% | ETH↔Base | 2/10 | $0 (no liq) | — | Monitor, wait for util drop |
| USDT0 | 3.24% | ARB↔Polygon | 1.5/10 | ~$5K | ~$13.50 | Pipeline test |
| **EURC** | **2.11%** | **ETH↔Base** | **1/10** | **$50-200K** | **$88-350** | **🎯 BEST TRADE** |
| USDT0 | 1.49% | ARB↔Monad | 1.5/10 | ~$10K | ~$12.40 | Marginal |

## Recommended First Trade: EURC Ethereum↔Base

**Why EURC wins:**
- Risk 1/10 — lowest possible
- Both collateral types Tier 1 (WBTC supply side, wstETH borrow side)
- $12.1M supply TVL, $2M available liquidity — can deploy $50-200K without rate impact
- 84% utilization — healthy, can withdraw
- 243 days old — proven
- 100% organic spread — no reward dependency
- Ethereum↔Base = primary corridor, best bridge support
- EURC = Circle's Euro stablecoin, institutional backing

**Flow:**
1. Acquire wstETH on Base → supply as collateral → borrow EURC at 0.84%
2. Bridge EURC to Ethereum via Across (~2 min)
3. Supply EURC to WBTC/EURC market at 2.95%
4. Net: 2.11% annualized

**Scaling:** $50K → $88/month. $200K → $350/month. Market can sustain $500K-$1M.

**Exit:** Reverse flow. Withdraw → bridge back → repay → withdraw collateral.

## Lessons
1. High spreads ≠ tradeable opportunities. Liquidity and bridge support are gatekeepers.
2. Negative borrow rates are reward farming, not arb. Treat as time-limited.
3. The risk/reward sweet spot is 2-6% organic spread on established assets.
4. USDC ETH↔Base has the deepest liquidity but specific market selection matters.
5. Monitor eUSD ETH↔Base — if utilization drops below 90%, it becomes the best risk-adjusted opportunity at 12.47% organic.
