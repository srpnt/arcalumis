# 🏰 The Citadel — DeFi Intelligence Dashboard

Central command interface for DeFi intelligence operations.

## Modules

| Module | Description |
|--------|-------------|
| **Morpho Markets** | Live vault & market data from Morpho (Ethereum + Base) |
| **Cross-Chain Differentials** | Rate spread analysis between chains |
| **Signals & Alerts** | Research findings and risk alerts |
| **Arkham Intel** | On-chain entity lookup via Arkham API |

## Setup

```bash
# Activate the virtual environment
source projects/dashboard/.venv/bin/activate

# Run the dashboard
streamlit run app.py
```

## Configuration

- **Theme:** Dark theme configured in `.streamlit/config.toml`
- **Credentials:** API keys in `~/.openclaw/workspace/credentials/apis.json`
- **Research:** Signal data from `~/.openclaw/workspace/research/*.md`

## Data Sources

- **Morpho:** GraphQL API at `https://api.morpho.org/graphql`
- **Arkham:** REST API (requires API key)
- **Research:** Tank's ecosystem scan files

## File Structure

```
projects/dashboard/
├── app.py                  # Main entry point
├── pages/
│   ├── 1_morpho.py         # Morpho Markets Overview
│   ├── 2_differentials.py  # Cross-Chain Differentials
│   ├── 3_signals.py        # Signals & Alerts
│   └── 4_arkham.py         # Arkham Intel
├── utils/
│   ├── morpho_api.py       # Morpho GraphQL client
│   ├── arkham_api.py       # Arkham REST client
│   └── config.py           # Credential loader
├── .streamlit/
│   └── config.toml         # Dark theme config
└── README.md
```

---

*Built by Trinity for The Crew.*
