# Morpho Protocol — Knowledge Base

## Overview
Morpho is a modular, permissionless DeFi lending protocol. Started as a P2P optimization layer on top of Aave/Compound, evolved into standalone infrastructure.

**Token:** MORPHO (~$1.30, ~$500M market cap, 378M circulating supply as of early 2026)

## Architecture

### Morpho Blue (Base Layer)
- **Trustless primitive** — the core lending/borrowing engine
- **Permissionless market creation** — anyone can create a lending market with:
  - Any asset pair
  - Custom LTV ratios
  - Custom liquidation triggers
  - Choice of oracle
- **No DAO governance needed** for market parameters
- **Immutable and simple** — designed to be a reliable base layer
- **Risk is localized** to specific markets, not global

### P2P Matching Engine (Core Innovation)
- When lender + borrower match directly → bypass pool spread
- Lender gets higher rate, borrower pays lower rate (both win)
- **Fallback mechanism**: if no P2P match available, routes to underlying pools (Morpho Blue vaults or third-party)
- This ensures liquidity is always available

### MetaMorpho (Curation Layer)
- Built on top of Morpho Blue
- Allows creation of "Meta-Lending" vaults
- **Risk curators** (professional risk managers) manage vault composition
- They select which Morpho Blue markets meet safety criteria
- Users get passive lending with professional risk oversight
- Separation of execution (Blue) from risk management (MetaMorpho)

## Why It Matters for Us
- **Better yields** — P2P matching eliminates pool spread overhead
- **Customizable risk** — choose vaults matching your risk profile
- **Modular** — can integrate with other DeFi (composability)
- **2026 narrative: "Real Yield"** — sustainable returns from protocol utility, not token emissions

## Comparison with Aave/Compound

| Feature | Aave/Compound (Peer-to-Pool) | Morpho |
|---------|------------------------------|--------|
| Matching | Socialized pool | P2P + pool fallback |
| Capital efficiency | Limited by spread | Optimized via direct matching |
| Market creation | DAO governance required | Permissionless |
| Risk management | Global parameters | Localized per market/vault |
| Oracle | DAO-selected | Market creator chooses |

## Deployment
- Ethereum mainnet (primary)
- Expanding ecosystem

## Key Endpoints for Tracking (via Arkham or on-chain)
- Monitor Morpho Blue market utilization rates
- Track vault TVL and yields
- Watch for new market creation events
- Entity tracking: who's depositing/borrowing large amounts

## Questions for Our Strategy
- Which Morpho vaults offer best risk-adjusted yield?
- How to monitor vault curator reputation/track record?
- Automated supply/withdraw based on rate changes?
- Integration with our wallet tracking system?
