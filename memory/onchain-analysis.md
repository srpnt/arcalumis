# On-Chain Analysis — Knowledge Base

## Core Methods

### 1. Wallet Holdings Tracking
- See current + historical holdings of any wallet
- Arkham deanonymizes addresses → links to real-world entities
- Use cases: verify claims, track influencers, monitor VCs/funds
- Arkham endpoint: `GET /intelligence/address/{address}`, `GET /balances/address/{address}`

### 2. Transaction Analysis
- Track flow of funds between addresses in real-time
- Each tx has unique hash with sender, recipient, timestamp, amount
- Use cases: copy-trading, hack monitoring, flow tracking
- Arkham endpoint: `GET /transfers`, `GET /transfers/tx/{hash}`

### 3. Top Holders
- See largest holders of any token (by wallet or by entity)
- Concentrated ownership = risk signal
- Large holder movements can move markets
- Arkham endpoint: `GET /token/holders/{id}`

### 4. Exchange Flows
- Inflow to exchange = bearish (depositing to sell)
- Outflow from exchange = bullish (withdrawing to hold)
- Track net flows over time for sentiment
- Arkham endpoint: `GET /flow/address/{address}`, `GET /flow/entity/{entity}`

### 5. Whale Alerts
- Real-time notifications for large transactions
- Arkham Alerts: email, Telegram, webhooks
- Arkham WebSocket: `GET /ws/transfers` for real-time streaming

### 6. Counterparty Analysis
- Who is a wallet/entity transacting with most?
- Reveals relationships, trading partners, fund flows
- Arkham endpoint: `GET /counterparties/address/{address}`

### 7. Institutional Movement
- ETF wallet tracking (BlackRock IBIT, Fidelity, etc.)
- Real-time inflow/outflow = institutional sentiment gauge
- Corporate treasury tracking (Strategy/MicroStrategy etc.)

### 8. Multi-chain Activity
- Track entities across 20+ chains via Arkham
- Arkham endpoint: `GET /intelligence/address/{address}/all`

## Arkham-Specific Best Practices
- Use entity endpoints when you know the entity name (more comprehensive)
- Use address endpoints for specific wallet monitoring
- Batch endpoints for bulk lookups (save API credits)
- WebSocket sessions for real-time monitoring (credit-efficient for streaming)
- Set up alerts for key wallets/thresholds

## Our Wallet Tracking System (Design TBD)
- Watch list of wallets/entities of interest
- Real-time alerts on significant movements
- Pattern detection (Tank's job)
- Historical analysis for strategy validation
- Cross-reference with DeFi protocol interactions (Morpho deposits, LP positions, etc.)
