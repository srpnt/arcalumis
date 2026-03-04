# Dune Analytics Integration — Roadmap

## Why Dune
Morpho's GraphQL API gives us current state only. For rate stability, historical analysis, and advanced risk modeling we need time-series data. Dune gives us:
- Historical rate snapshots (supply/borrow APY over time)
- Market creation & lifecycle events
- Bad debt incidents
- Whale activity (large deposits/withdrawals)
- Utilization spikes & withdrawal crunches

## API Access
- Dune API key stored in `credentials/apis.json` (key obtained day 1)
- Endpoint: `https://api.dune.com/api/v1/`
- Rate limits: depends on plan tier (need to verify)

## Phase 1: Rate Stability (Priority)

**Goal**: Know whether a market's rates are stable or volatile before entering a position.

**What to build**:
1. **Daily snapshot job** — cron/heartbeat task that runs our scanner and saves results to `data/rate-snapshots/YYYY-MM-DD.json`. Cheap, immediate, builds our own history starting now.

2. **Dune queries for historical rates** — write SQL against Morpho Blue event tables:
   - `MorphoBlue_evt_AccrueInterest` — gives us rate updates per market per block
   - Group by market + day, compute daily avg/min/max supply & borrow APY
   - Query params: market uniqueKey, date range, chain

3. **Rate volatility metric** — for each market, compute:
   - 7d/30d standard deviation of supply APY
   - Max drawdown (largest rate drop in period)
   - Rate persistence score: % of days where rate stayed within ±20% of current
   
4. **Dashboard integration** — add to risk breakdown:
   - "Rate stability: High/Medium/Low" based on 30d std dev
   - Sparkline chart of historical rates (last 30d)

**Dune SQL sketch** (Ethereum Morpho Blue):
```sql
SELECT
  date_trunc('day', evt_block_time) as day,
  id as market_id,
  AVG(prevBorrowRate) as avg_borrow_rate,
  AVG(CAST(supplyAssets AS DOUBLE) / NULLIF(CAST(supplyShares AS DOUBLE), 0)) as supply_metric,
  COUNT(*) as accrual_events
FROM morpho_blue_ethereum.MorphoBlue_evt_AccrueInterest
WHERE id = {{market_id}}
  AND evt_block_time >= NOW() - INTERVAL '30' DAY
GROUP BY 1, 2
ORDER BY 1
```
*Note: Exact table names and column schemas need verification against Dune's Morpho decoder.*

## Phase 2: Bad Debt & Liquidation History

**Goal**: Know if a market has had bad debt events or large liquidation cascades.

**What to query**:
- `MorphoBlue_evt_Liquidate` — liquidation events per market
- Aggregate: total liquidations, largest single liquidation, liquidation frequency
- Bad debt: where collateral seized < debt repaid (borrower underwater)

**Risk signal**: Markets with frequent liquidations aren't necessarily bad (healthy liquidation = system working). Markets with *bad debt* (underwater liquidations) are the red flag.

## Phase 3: Whale Tracking & Flow Analysis

**Goal**: Detect large position changes that might signal insider knowledge or rate manipulation.

**What to query**:
- `MorphoBlue_evt_Supply` / `MorphoBlue_evt_Withdraw` — filter by amount > threshold
- `MorphoBlue_evt_Borrow` / `MorphoBlue_evt_Repay` — same
- Cross-reference with Arkham for entity identification

**Risk signal**: If a whale withdraws 30% of a market's supply in one tx, utilization spikes and everyone else gets locked in.

## Phase 4: Cross-Chain Rate Correlation

**Goal**: Understand whether rate differentials are structural (persistent) or transient (noise).

**What to build**:
- Time-aligned rate series across chains for same asset
- Correlation analysis: do rates converge over time? How fast?
- Identify structural spreads (from chain-specific dynamics like emissions, bridging friction) vs transient ones

This directly informs our arb strategy: structural spreads are where we farm. Transient ones are where we trade fast.

## Implementation Order
1. Start daily snapshots immediately (no Dune needed, just our scanner → JSON)
2. Write + validate Dune SQL queries for rate history
3. Build a `lib/dune.ts` client in Citadel for querying
4. Add historical data to risk breakdown
5. Bad debt queries
6. Whale tracking

## Dependencies
- [ ] Verify Dune API plan tier and rate limits
- [ ] Confirm Morpho Blue table names on Dune for each chain (Ethereum, Base, Arbitrum)
- [ ] Set up daily snapshot cron job
