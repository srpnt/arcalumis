# 🏰 The Citadel — DeFi Intelligence Dashboard

Real-time DeFi intelligence and risk monitoring dashboard focused on the Morpho ecosystem.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Charts:** Recharts
- **Data Fetching:** SWR
- **Language:** TypeScript (strict)
- **External APIs:** Morpho GraphQL, Arkham Intelligence, CoinGecko, Etherscan

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your values:
   - `ARKHAM_API_KEY` — Your Arkham Intelligence API key
   - `ARKHAM_BASE_URL` — Arkham API base URL (default: `https://api.arkhamintelligence.com`)
   - `MORPHO_API_URL` — Morpho GraphQL endpoint (default: `https://api.morpho.org/graphql`)
   - `WORKSPACE_DIR` — Path to the workspace directory containing `data/` and `research/` folders

3. Start development server:
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
projects/citadel/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Dashboard — protocol health monitor
│   ├── layout.tsx                # Root layout with sidebar
│   ├── morpho/page.tsx           # Morpho vault explorer with charts
│   ├── intel/page.tsx            # Intel hub — curators, token activity, concentration
│   ├── exposure/page.tsx         # Collateral exposure & risk tiers
│   ├── yield-comparison/page.tsx # Cross-chain yield comparison (ETH vs Base)
│   ├── signals/page.tsx          # Research signals & alerts feed
│   └── api/                      # API routes
│       ├── morpho/route.ts       # Morpho GraphQL proxy (avoids CORS)
│       ├── intel/[...path]/      # Arkham Intelligence API proxy
│       ├── exposure/route.ts     # Collateral exposure aggregation
│       ├── signals/route.ts      # Research signal parser
│       └── whales/route.ts       # Whale watchlist reader
├── components/                   # Reusable UI components
│   ├── ChainBadge.tsx            # Chain identifier badge
│   ├── ChainDonut.tsx            # Chain distribution donut chart
│   ├── DataTable.tsx             # Sortable, expandable data table
│   ├── MetricCard.tsx            # Metric display card
│   ├── RiskTierBadge.tsx         # Risk tier badge
│   ├── Sidebar.tsx               # Collapsible navigation sidebar
│   ├── SignalCard.tsx            # Expandable signal alert card
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── DashboardMetricCard.tsx
│   │   ├── RateOpportunities.tsx
│   │   ├── RecentSignals.tsx
│   │   ├── RiskPanel.tsx
│   │   ├── StablecoinRow.tsx
│   │   ├── UtilizationAlerts.tsx
│   │   └── useDashboardData.ts   # Data fetching hook
│   ├── intel/                    # Intel hub components
│   │   ├── CuratorCard.tsx
│   │   ├── TokenActivityFeed.tsx
│   │   ├── VaultConcentrationTable.tsx
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   ├── types.ts
│   │   └── useIntelData.ts       # Data fetching hook
│   ├── morpho/                   # Morpho page components
│   │   ├── ChartTooltips.tsx
│   │   └── HotVaultCard.tsx
│   ├── exposure/                 # Exposure page components
│   │   ├── ChartTooltips.tsx
│   │   └── TreemapContent.tsx
│   └── yield-comparison/         # Yield comparison components
│       ├── ButterflyTooltip.tsx
│       └── ROICalculator.tsx
├── lib/                          # Shared libraries
│   ├── arkham.ts                 # Arkham Intelligence client
│   ├── format.ts                 # Number/currency formatters
│   ├── morpho.ts                 # Morpho GraphQL client
│   ├── signals.ts                # Research signal parser (server-side)
│   └── types.ts                  # TypeScript interfaces
├── scripts/                      # Data pipeline scripts
│   ├── check-whale-movements.py  # Whale balance change detector
│   └── update-whale-watchlist.py # Whale watchlist builder
├── .env.example                  # Environment variable template
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/morpho` | POST | Proxies GraphQL queries to Morpho API |
| `/api/intel/[...path]` | GET | Proxies requests to Arkham Intelligence API |
| `/api/exposure` | GET | Aggregates collateral exposure data with risk tiers |
| `/api/signals` | GET | Parses research markdown files for risk signals |
| `/api/whales` | GET | Serves the whale watchlist from disk |

## Scripts

### `update-whale-watchlist.py`
Builds a deduplicated whale watchlist by fetching:
- Top MORPHO token holders (via Arkham API)
- Top vault depositors (via Morpho GraphQL)
- Enriches addresses with Arkham entity labels

```bash
python3 scripts/update-whale-watchlist.py
```

### `check-whale-movements.py`
Monitors whale addresses for significant balance changes (>10% threshold).

```bash
python3 scripts/check-whale-movements.py
```

Both scripts support the `WORKSPACE_DIR` and `ARKHAM_API_KEY` environment variables.

## Pages

- **Dashboard** (`/`) — Protocol health overview with utilization alerts, rate opportunities, risk panel
- **Morpho Markets** (`/morpho`) — Full vault explorer with TVL/APY charts and sortable table
- **Yield Comparison** (`/yield-comparison`) — ETH vs Base rate comparison with ROI calculator
- **Collateral Exposure** (`/exposure`) — Risk-tiered collateral treemap and market breakdown
- **Signals** (`/signals`) — Filtered feed of research-derived risk alerts
- **Intel Hub** (`/intel`) — Curator tracking, MORPHO token flows, vault concentration analysis
