# Morpho Ecosystem Scan — 2026-03-03 16:55 CET

**Operator:** Tank
**Sources:** Morpho GraphQL API (api.morpho.org/graphql), DeFiLlama API
**Data freshness:** Live as of scan time

---

## Executive Summary

Morpho protocol sits at **$5.8B TVL** (supply-side) with **$3.5B in active borrows** across 15+ chains. Apollo's 9% token acquisition (Feb 2026) catalyzed a 45.9% TVL surge. Ethereum Foundation deposited $6M. The ecosystem is maturing rapidly with institutional players entering.

**Key finding:** Significant rate differentials exist between Ethereum and Base for USDC vaults, with Ethereum consistently yielding 1.5-3x higher net APY. Base has concentrated its TVL into a single massive cbBTC/USDC market ($1B+). Several high-yield opportunities exist on Ethereum through reward stacking.

---

## 1. Protocol-Level TVL Breakdown

| Chain | Supply TVL | Borrowed | Utilization |
|-------|-----------|----------|-------------|
| **Ethereum** | $2,877M | $1,955M | 67.9% |
| **Base** | $1,964M | $1,031M | 52.5% |
| Hyperliquid L1 | $422M | $119M | 28.1% |
| Katana | $268M | $84M | 31.3% |
| Arbitrum | $94M | $96M | 102%* |
| Monad | $74M | $51M | 68.5% |
| **Total** | ~$5.8B | ~$3.5B | ~60.3% |

*Arbitrum borrowed > supply = cross-collateral or accounting lag

---

## 2. Top Vaults by TVL

### Ethereum — V1 (MetaMorpho) Vaults

| Vault | Asset | TVL | Net APY | Fee | Notes |
|-------|-------|-----|---------|-----|-------|
| Sentora PYUSD | PYUSD | $236.2M | 1.92% | 0% | Largest by TVL; PYUSD+MORPHO rewards boost to ~7% on V2 |
| Steakhouse USDC | USDC | $161.7M | 7.10% | 0% | Flagship USDC vault |
| Gauntlet USDC Prime | USDC | $156.0M | 6.66% | 0% | Conservative allocation |
| Steakhouse USDT | USDT | $149.0M | 3.09% | 0% | Lower rates than USDC |
| Vault Bridge USDC | USDC | $134.7M | 6.58% | 5% | Bridge vault for L2 |
| Gauntlet USDC Frontier | USDC | $118.3M | **7.97%** | 5% | Higher yield, higher risk |
| Gauntlet USDT Frontier | USDT | $85.2M | 3.19% | 5% | |
| Steakhouse Reservoir USDC | USDC | $78.0M | **10.0%** | 0% | DAM reward-boosted |
| Steakhouse ETH | WETH | $70.8M | 1.94% | 5% | |
| Vault Bridge WBTC | WBTC | $70.0M | 0.08% | 5% | Very low yield |
| Smokehouse USDC | USDC | $59.2M | **8.01%** | 0% | High yield frontier |

### Ethereum — V2 Vaults

| Vault | Asset | TVL | Avg Net APY | Notes |
|-------|-------|-----|-------------|-------|
| Sentora PYUSD Main | PYUSD | $236.2M | **7.0%** | PYUSD rewards (4.3%) + MORPHO (0.6%) |
| Gauntlet USDC Prime | USDC | $66.5M | 5.21% | MORPHO rewards |
| Steakhouse Reservoir USDC | USDC | $66.4M | **7.82%** | DAM (3.1%) + MORPHO rewards |
| Gauntlet USDC Frontier | USDC | $60.3M | 5.52% | |
| sky.money USDT Risk Capital | USDT | $38.7M | 4.53% | USDS rewards (2.7%) |
| sky.money USDC Risk Capital | USDC | $37.7M | 5.36% | USDS rewards (2.7%) |
| Re Ecosystem Vault | USDC | $18.1M | **6.82%** | 10% perf fee |
| August USDC V2 | USDC | $19.3M | **5.98%** | Clean, no fee |
| Clearstar USDC Core | USDC | $4.3M | **6.43%** | 9% perf fee |

### Base — V1 (MetaMorpho) Vaults

| Vault | Asset | TVL | Net APY | Fee | Notes |
|-------|-------|-----|---------|-----|-------|
| Gauntlet USDC Prime | USDC | $329.3M | 4.15% | 0% | Largest Base vault |
| Steakhouse Prime USDC | USDC | $328.4M | 4.14% | 0% | Nearly identical |
| Steakhouse USDC (old) | USDC | $285.8M | 3.09% | **25%** | HIGH FEE — avoid |

### Base — V2 Vaults

| Vault | Asset | TVL | Net APY | Notes |
|-------|-------|-----|---------|-------|
| Gauntlet USDC Prime | USDC | $27.6M | 4.05% | No rewards |
| Gauntlet USDC Frontier | USDC | $9.9M | 4.48% | |
| Steakhouse Prime USDC | USDC | $8.7M | 4.05% | |
| Steakhouse High Yield USDC | USDC | $8.0M | 4.47% | |
| Steakhouse Prime EURC | EURC | $5.1M | 0.49% | Very low demand |
| Gauntlet WETH Balanced | WETH | $2.2M | 1.64% | |

---

## 3. Top Underlying Markets (Ethereum)

| Collateral → Loan | Supply ($M) | Supply APY | Borrow APY | Utilization | LLTV |
|-------------------|-------------|-----------|-----------|-------------|------|
| cbBTC → USDC | $421.7M | **6.67%** | 7.13% | 93.7% | 86% |
| wstETH → WETH | $123.4M | 2.05% | 2.38% | 86.0% | 96.5% |
| sUSDS → USDT | $123.2M | 2.61% | 2.92% | 89.6% | 96.5% |
| sUSDe → PYUSD | $103.5M | 2.30% | 2.78% | 83.0% | 91.5% |
| WBTC → USDC | $85.4M | **6.94%** | 7.40% | 94.0% | 86% |
| wsrUSD → USDC | $77.6M | **6.65%** | 7.15% | 93.2% | 94.5% |
| **siUSD → USDC** | **$76.6M** | **12.37%** | **12.97%** | **95.6%** | **91.5%** |
| wstETH → USDC | $67.6M | **7.01%** | 7.47% | 94.0% | 86% |
| sUSDD → USDT | $60.0M | 2.95% | 4.06% | 73.2% | 91.5% |
| WBTC → USDT | $58.9M | 2.62% | 2.92% | 89.7% | 86% |
| sUSDe → USDtb | $50.5M | 4.66% | 4.69% | 99.3% | 91.5% |
| weETH → WETH | $48.2M | 2.05% | 2.39% | 85.9% | 94.5% |
| PT-reUSD → USDC | $47.7M | **6.70%** | 7.48% | 90.0% | 91.5% |
| AA_FalconX → USDC | $40.7M | **6.88%** | 7.51% | 91.9% | 77% |
| stcUSD → USDC | $28.4M | **7.15%** | 7.71% | 93.0% | 91.5% |
| mF-ONE → USDC | $15.2M | **7.77%** | 8.47% | 92.1% | 91.5% |

### Top Markets (Base)

| Collateral → Loan | Supply ($M) | Supply APY | Borrow APY | Utilization | LLTV |
|-------------------|-------------|-----------|-----------|-------------|------|
| cbBTC → USDC | $1,033M | 4.15% | 4.61% | 90.2% | 86% |
| WETH → USDC | $52.2M | 4.17% | 4.62% | 90.3% | 86% |
| wstETH → WETH | $14.4M | 1.73% | 2.23% | 77.5% | 94.5% |
| cbXRP → USDC | $7.7M | **5.21%** | 5.80% | 90.1% | 62.5% |
| cbBTC → EURC | $7.6M | 1.01% | 1.12% | 90.3% | 86% |
| weETH → WETH | $3.7M | 1.76% | 2.25% | 78.2% | 94.5% |
| yoUSD → USDC | $3.0M | 3.62% | 4.89% | 74.6% | 91.5% |

---

## 4. Rate Differentials Analysis

### 🟡 Signal: ETH Mainnet USDC Vaults Yield 1.5-2x More Than Base

| Comparison | Ethereum APY | Base APY | Spread |
|-----------|-------------|---------|--------|
| USDC Prime (Gauntlet) | 6.66% (V1) / 5.21% (V2) | 4.15% (V1) / 4.05% (V2) | **+2.5% / +1.16%** |
| USDC Frontier (Gauntlet) | 7.97% (V1) / 5.52% (V2) | 4.48% (V2) | **+3.5% / +1.04%** |
| Steakhouse USDC | 7.10% (V1) / 5.13% (V2) | 4.14% (V1) / 4.05% (V2) | **+3.0% / +1.08%** |
| WETH (Steakhouse) | 1.94% | 1.66% | +0.28% |

**Interpretation:** Ethereum consistently offers higher supply APY, driven by:
1. More diverse and higher-demand collateral (WBTC, wstETH, PT tokens, RWA tokenized assets)
2. Higher utilization on USDC markets (93-95% ETH vs 90% Base)
3. MORPHO reward stacking on ETH vaults (0.23-0.69% additional)
4. Lack of reward incentives on Base vaults (nearly zero)

**Base's story is concentration risk:** ~$930M of the ~$1B cbBTC/USDC market is borrowed. The entire Base Morpho ecosystem essentially runs on one market pair.

### 🟡 Signal: USDT Significantly Underperforms USDC on Ethereum

| Asset | Best Net APY | Notes |
|-------|------------|-------|
| USDC | 7.1-10.0% | Wide vault selection, strong demand |
| USDT | 3.1-3.6% | Lower borrow demand, fewer collateral pairs |
| PYUSD | 1.9-7.0% | Only attractive with reward stacking |

**Spread: 3-7% between USDC and USDT.** This is significant. USDT borrowers are paying less, and the ecosystem strongly prefers USDC as a lending asset.

---

## 5. Interesting Patterns & Anomalies

### 🔴 Alert: siUSD/USDC Market — 12.37% Supply APY

- **Market:** siUSD collateral → USDC loan
- **Supply APY:** 12.37% | **Borrow APY:** 12.97%
- **Utilization:** 95.6% | **TVL:** $76.6M
- **LLTV:** 91.5%
- This is **~2x the typical USDC rate.** siUSD (Silicone USD) may carry higher risk → hence the premium. Worth monitoring — either an opportunity or a warning.

### 🟡 Steakhouse Reservoir USDC — 10.0% Net APY (V1)

- Boosted by DAM token rewards (3.1% APR) + MORPHO
- $78M TVL, real demand
- Worth investigating DAM token sustainability

### 🟡 Smokehouse USDC — 8.01% Net APY

- Frontier risk profile, no management fee
- $59.2M TVL
- Higher risk collateral exposure but competitive returns

### 🟡 fxUSD Agentic Stablecoin (Base) — 10.6% Net APY

- $1M TVL, tiny but interesting
- 10.6% APR comes entirely from FXUSD rewards
- Very new, experimental

### 🟡 Clearstar Reactor USDC (Base) — 7.3% Net APY

- Boosted by YO token rewards (4.0% APR)
- $300K TVL — micro vault, reward-dependent

### 🟢 EURC Markets on Base — Very Low Yields (0.5-1.0%)

- Minimal borrow demand for EUR stablecoins
- EURC vaults returning <1% — barely above zero
- Not worth the smart contract risk at these rates

### 🟢 Base Steakhouse USDC (old V1) — 25% Performance Fee

- Still holds $285M TVL at 25% fee (!)
- Net APY: 3.09% vs Prime version at 4.14% with 0% fee
- **$285M earning 1.05% less annually = ~$3M/yr in excess fees**
- Depositors likely haven't migrated — LP inertia at work

### 🟢 Vault Bridge WBTC (Ethereum) — 0.08% APY

- $70M sitting at essentially 0% yield
- Exists for bridge infrastructure, not yield
- Dead capital from a yield perspective

---

## 6. Macro Context

- **Apollo Global ($940B AUM)** acquired 9% of MORPHO token supply (Feb 13, 2026)
- **Coinbase** integrated Morpho for $960M active loans
- **Bitwise** launched yield vaults targeting 6% APY
- **RWA deposits** surged 40x YoY to $400M
- **Telegram** wallet integration with Re7 USDT Morpho Vault (up to 18% advertised)
- **Ethereum Foundation** deposited $6M into Morpho vaults
- **MORPHO token:** ~$1.70 range, ~$500M+ market cap
- Protocol generates **7,200 ETH/month** in fees but no fee switch activated yet

---

## 7. Recommended Actions

### Immediate (Informational)

1. **Monitor siUSD/USDC market** — 12.4% supply APY at $77M TVL is an outlier. Could be legitimate risk premium or early warning of depegging risk.

2. **Track Base cbBTC/USDC concentration** — $1B+ in a single market is systemic risk. If cbBTC has any issue, Base Morpho TVL gets hammered.

3. **USDC > USDT** for passive lending on Morpho. The spread is 3-7% with no additional risk.

### Medium-Term (Strategy)

4. **Best risk-adjusted USDC yield on Ethereum:**
   - Conservative: Gauntlet USDC Prime V1 — 6.66% net (0% fee)
   - Moderate: Steakhouse USDC V1 — 7.10% net (0% fee)
   - Aggressive: Gauntlet USDC Frontier V1 — 7.97% net (5% fee)
   - Reward-boosted: Steakhouse Reservoir — 10.0% (depends on DAM sustainability)

5. **Base is a yield desert right now** — 4.0-4.5% for USDC is significantly below Ethereum. Unless you need to stay on Base for other reasons, ETH mainnet vaults dominate.

6. **Watch for MORPHO fee switch activation** — 7,200 ETH/month fees with no token value capture yet. When this flips, could significantly impact token price.

### Future Research

7. **Drill into curator track records** — Gauntlet vs Steakhouse vs August vs Clearstar risk management quality
8. **Map whale positions** — Who's the $236M in Sentora PYUSD? Likely PayPal-adjacent or institutional
9. **Monitor new chain deployments** — Hyperliquid L1 ($422M), Katana ($268M), Monad ($74M) are growing fast

---

## Raw Data Notes

- V1 (MetaMorpho) and V2 vaults coexist; many V1 vaults have larger TVL
- V2 uses "adapters" instead of direct market allocations
- `avgApy` field is deprecated in V2 — use `avgNetApy` or `avgNetApyExcludingRewards`
- Base market data was polluted by spam GMORPHO/cbBTC markets (100% utilization, 41800% APY) — filtered out
- Some Ethereum markets show 100% utilization with ~2980% APY (USR/BONDUSD, USDC/sdeUSD, USDC/PAXG) — likely illiquid or stuck markets, not real yield opportunities

---

*Scan complete. Tank out.*
