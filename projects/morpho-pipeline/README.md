# Morpho Data Pipeline

Data pipeline scaffolding for monitoring the Morpho lending protocol across Ethereum and Base.

## Overview

This pipeline fetches real-time market and vault data from the **Morpho GraphQL API** (`https://api.morpho.org/graphql`). No API key required — the public endpoint supports 5,000 requests per 5 minutes.

## Setup

```bash
# No dependencies beyond Python 3.10+ stdlib
# Just run it:
cd projects/morpho-pipeline
python morpho_client.py
```

Zero external dependencies. Uses only `urllib`, `json`, `dataclasses` from stdlib.

## Usage

```bash
# Full protocol snapshot (markets + vaults, pretty-printed)
python morpho_client.py

# Markets only
python morpho_client.py markets

# Vaults only
python morpho_client.py vaults

# Single market detail (raw JSON)
python morpho_client.py market 0x698fe98247a40c5771537b5786b2f3f9d78eb487b4ce4d75533cd0e94d88a115

# Single vault detail
python morpho_client.py vault 0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB --chain 1

# Base chain only, top 20
python morpho_client.py markets --chain 8453 --top 20

# JSON output
python morpho_client.py --json

# Save snapshot to file
python morpho_client.py snapshot -o snapshot.json
```

## What It Fetches

### Markets
- Asset pair (collateral/loan)
- Supply TVL (USD)
- Borrow volume (USD)
- Available liquidity (USD)
- Utilization rate
- Supply & borrow APY
- Reward programs (token, APR)
- Risk warnings

### Vaults (MetaMorpho)
- Name, symbol, chain
- Total assets (USD)
- APY / Net APY
- Fee structure
- Market allocation count
- Curator info (single vault queries)

## Architecture

```
morpho_client.py      # Single-file client, zero deps
├── MorphoClient      # Main class — fetch_markets(), fetch_vaults(), snapshot()
├── GraphQL queries   # Embedded queries for markets, vaults, detail views
├── Data models       # MarketSummary, VaultSummary dataclasses
└── CLI               # argparse-based interface with table/JSON output
```

### Extending

The `MorphoClient` class is designed to be imported:

```python
from morpho_client import MorphoClient

client = MorphoClient(chains=[1, 8453], top_n=100)
markets = client.fetch_markets()
vaults = client.fetch_vaults()
snapshot = client.snapshot()
```

### Future extensions (not yet built)
- **Historical tracking:** Periodic snapshots → time series DB
- **Alerts:** Rate/TVL change detection → notifications
- **Arkham integration:** Cross-reference large depositors/borrowers with Arkham entity data
- **TheGraph fallback:** Query subgraphs when API is down
- **Vault V2 queries:** The API supports newer `vaultV2s` endpoints with adapter-based allocation data

## Data Sources

See [data_sources.md](data_sources.md) for the full reference of:
- Morpho GraphQL API details and rate limits
- TheGraph subgraph deployment IDs for all chains
- Smart contract addresses (Morpho Blue core: `0xBBBBBbbBBb9cc5e90e3b3Af64bdAF62C37EEFFCb`)
- Dune Analytics dashboard links

## Project Context

Part of **The Citadel** — on-chain intelligence and capital deployment system.
This module handles DeFi market monitoring (Morpho first). See `agents/trinity.md` for the full project scope.
