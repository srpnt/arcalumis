# Arkham Intel API Reference

**Base URL:** `https://api.arkm.com`
**Docs:** https://intel.arkm.com/api/docs
**LLM Docs:** https://intel.arkm.com/llms.txt
**Full LLM Docs:** https://intel.arkm.com/llms-full.txt
**OpenAPI Spec:** https://intel.arkm.com/openapi.json
**Endpoint doc pattern:** `https://intel.arkm.com/llms/<method>-<path>.md`

## Auth
- API key based, credits-billed per endpoint
- Ivan has API access (confirmed 2026-03-03)

## Key Endpoints

### Intelligence (entity/address attribution)
- `GET /intelligence/address/{address}` — address intel
- `GET /intelligence/address/{address}/all` — across all chains
- `POST /intelligence/address/batch` — batch lookup
- `POST /intelligence/address/batch/all` — batch across all chains
- `GET /intelligence/address_enriched/{address}` — enriched intel
- `GET /intelligence/entity/{entity}` — entity intel
- `GET /intelligence/entity/{entity}/summary` — entity summary stats
- `GET /intelligence/search` — search addresses, entities, tokens
- `GET /intelligence/contract/{chain}/{address}` — contract intel
- `GET /intelligence/entity_predictions/{entity}` — predictions
- `GET /intelligence/entity_balance_changes` — balance changes
- Updates: `/intelligence/addresses/updates`, `/intelligence/entities/updates`, `/intelligence/tags/updates`, `/intelligence/address_tags/updates`

### Balances & Portfolio
- `GET /balances/address/{address}` — token balances for address
- `GET /balances/entity/{entity}` — token balances for entity
- `GET /balances/solana/subaccounts/address/{addresses}` — Solana subaccounts
- `GET /portfolio/address/{address}` — address portfolio history
- `GET /portfolio/entity/{entity}` — entity portfolio history
- `GET /portfolio/timeSeries/address/{address}` — daily time series
- `GET /portfolio/timeSeries/entity/{entity}` — daily time series

### Transfers
- `GET /transfers` — get transfers
- `GET /transfers/tx/{hash}` — transfers for a tx
- `GET /transfers/histogram` — detailed histogram (API only)
- `GET /transfers/histogram/simple` — simple histogram (public)
- `GET /tx/{hash}` — transaction details

### Flow & Volume
- `GET /flow/address/{address}` — historical USD flows
- `GET /flow/entity/{entity}` — entity USD flows
- `GET /volume/address/{address}` — transfer volume
- `GET /volume/entity/{entity}` — entity volume

### Counterparties
- `GET /counterparties/address/{address}` — top counterparties
- `GET /counterparties/entity/{entity}` — entity counterparties

### Tokens
- `GET /token/market/{id}` — current market data
- `GET /token/holders/{id}` — top holders
- `GET /token/holders/{chain}/{address}` — holders by chain
- `GET /token/price/history/{id}` — price history
- `GET /token/price_change/{id}` — price change since timestamp
- `GET /token/top` — top tokens by exchange activity
- `GET /token/trending` — trending tokens
- `GET /token/volume/{id}` — volume
- `GET /token/balance/{id}` — token balance for entity/address
- `GET /token/top_flow/{id}` — top flow
- `GET /token/addresses/{id}` — chain addresses for token

### Swaps & Loans
- `GET /swaps` — get swaps
- `GET /loans/address/{address}` — loan/borrow positions
- `GET /loans/entity/{entity}` — entity loan positions

### Tags & Clusters
- `GET /tag/{id}/params` — tag parameters
- `GET /tag/{id}/summary` — tag summary stats
- `GET /cluster/{id}/summary` — cluster summary

### User/Private
- `GET /user/entities` — list private entities
- `GET /user/entities/{id}` — get private entity
- `PUT /user/entities/only_add/{id}` — update private entity
- `GET /user/labels` — get user labels
- `POST /user/labels` — create labels

### WebSocket (real-time)
- `POST /ws/sessions` — create WS session
- `GET /ws/transfers` — stream transfers
- `GET /ws/sessions` — list sessions
- `DELETE /ws/sessions/{id}` — delete session

### Network & Market
- `GET /chains` — supported chains
- `GET /networks/status` — all chains status
- `GET /networks/history/{chain}` — chain history
- `GET /marketdata/altcoin_index` — altcoin index
- `GET /arkm/circulating` — ARKM circulating supply

## Data Model
- **Entity-first:** built around real-world actors, not isolated addresses
- **Confidence-scored:** attribution is probabilistic
- **Living intelligence:** labels evolve as new signals emerge
- 20+ chains supported

## Code Examples
- Bash CLI: https://intel.arkm.com/cookbook/cli/arkham-cli.sh
- Python demo: https://intel.arkm.com/cookbook/cli/arkham_demo.py
- Python REST: https://intel.arkm.com/cookbook/cli/rest_example.py
- Python WebSocket: https://intel.arkm.com/cookbook/cli/websocket_example.py
