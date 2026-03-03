# Morpho Data Sources

## 1. Official Morpho GraphQL API (Primary)

**Endpoint:** `https://api.morpho.org/graphql`
**Playground:** [https://api.morpho.org/graphql](https://api.morpho.org/graphql)
**Type:** GraphQL
**Auth:** None (public, rate-limited)
**Rate Limit:** 5,000 requests / 5 minutes
**Max Query Complexity:** 1,000,000

### Supported Chains
| Chain         | Chain ID |
|---------------|----------|
| Ethereum      | 1        |
| Base          | 8453     |
| Arbitrum      | 42161    |
| OP Mainnet    | 10       |
| Polygon       | 137      |
| HyperEVM      | 999      |
| Katana        | 747474   |
| Monad         | 143      |
| Unichain      | 130      |
| Stable        | 988      |

### Available Data
- **Markets:** List, metrics (TVL, borrow, supply, utilization), APYs (native + rewards), oracle data, liquidations, warnings, historical timeseries
- **Vaults (V1 & V2):** List, total assets/deposits, APY, allocations/strategy, curator info, depositor positions, transaction history
- **Positions:** User market positions, vault positions, account overview
- **Assets:** Price, yield, historical price
- **Rewards:** Dedicated REST API at `https://rewards.morpho.org/docs`

### Key Query Patterns
- Filter by chain: `where: { chainId_in: [1, 8453] }`
- Pagination: `first: N, skip: M`
- Ordering: `orderBy: SupplyAssetsUsd, orderDirection: Desc`
- Historical: via `historicalState` on individual market/vault queries (not on list queries)

---

## 2. TheGraph Subgraphs (Alternative / On-Chain Indexed)

Community-maintained, Messari Schema standard for Lending protocols.
Requires a Graph API key for programmatic access (free tier available via [The Graph Studio](https://thegraph.com/studio/apikeys/)).

### Deployment URLs (Explorer Links)
| Network         | Explorer URL |
|-----------------|-------------|
| Ethereum        | [8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs](https://thegraph.com/explorer/subgraphs/8Lz789DP5VKLXumTMTgygjU2xtuzx8AhbaacgN5PYCAs) |
| Base            | [71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs](https://thegraph.com/explorer/subgraphs/71ZTy1veF9twER9CLMnPWeLQ7GZcwKsjmygejrgKirqs) |
| Arbitrum        | [XsJn88DNCHJ1kgTqYeTgHMQSK4LuG1LR75339QVeQ26](https://thegraph.com/explorer/subgraphs/XsJn88DNCHJ1kgTqYeTgHMQSK4LuG1LR75339QVeQ26) |
| OP Mainnet      | [5y8d3K3vVCR7r5YwANGCjupLc3hUge54XvhYMEq3Jmq1](https://thegraph.com/explorer/subgraphs/5y8d3K3vVCR7r5YwANGCjupLc3hUge54XvhYMEq3Jmq1) |
| Polygon POS     | [EhFokmwryNs7qbvostceRqVdjc3petuD13mmdUiMBw8Y](https://thegraph.com/explorer/subgraphs/EhFokmwryNs7qbvostceRqVdjc3petuD13mmdUiMBw8Y) |
| Scroll          | [Aic7prLAxhtipUEbLu5BhDDWf4LssT9n3DG4fT9yCRqm](https://thegraph.com/explorer/subgraphs/Aic7prLAxhtipUEbLu5BhDDWf4LssT9n3DG4fT9yCRqm) |
| Sonic           | [J2THmwKHrTLKT9HPZNwZ69NkJ7WSbtLKz7pUQZW1Z1Qc](https://thegraph.com/explorer/subgraphs/J2THmwKHrTLKT9HPZNwZ69NkJ7WSbtLKz7pUQZW1Z1Qc) |
| Corn            | [4SswjwWRyBryaEBwzHfwayEpJWRS9f7xvsGC5kE6govQ](https://thegraph.com/explorer/subgraphs/4SswjwWRyBryaEBwzHfwayEpJWRS9f7xvsGC5kE6govQ) |
| Fraxtal         | [CDFzHFQTXj1ryFgA8KpkUuv6qu3Jk6fLG7kzdpuCe95g](https://thegraph.com/explorer/subgraphs/CDFzHFQTXj1ryFgA8KpkUuv6qu3Jk6fLG7kzdpuCe95g) |
| Hemi            | [2JZScBV6sD7BdoU9JBAwYPrbzUarPGGz9P1xVWFQxmdX](https://thegraph.com/explorer/subgraphs/2JZScBV6sD7BdoU9JBAwYPrbzUarPGGz9P1xVWFQxmdX) |
| Ink             | [7pezYZCEJVBbZbbkjLFcPo3hdVUxUv8skF2FqGibRcfk](https://thegraph.com/explorer/subgraphs/7pezYZCEJVBbZbbkjLFcPo3hdVUxUv8skF2FqGibRcfk) |
| MODE            | [341uEcvH1UAzWETvVB974Au1YR3MksJdf2jhjuHXDLQ7](https://thegraph.com/explorer/subgraphs/341uEcvH1UAzWETvVB974Au1YR3MksJdf2jhjuHXDLQ7) |
| Unichain        | [ESbNRVHte3nwhcHveux9cK4FFAZK3TTLc5mKQNtpYgmu](https://thegraph.com/explorer/subgraphs/ESbNRVHte3nwhcHveux9cK4FFAZK3TTLc5mKQNtpYgmu) |

### Query URL Pattern
```
https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID}
```

### GitHub
[morpho-org/morpho-blue-subgraph](https://github.com/morpho-org/morpho-blue-subgraph)

---

## 3. Smart Contract Addresses

### Morpho Blue (Core Lending Engine)
Same address on both Ethereum and Base (CREATE2 deterministic deployment):

| Contract | Address | Networks |
|----------|---------|----------|
| **Morpho (core)** | `0xBBBBBbbBBb9cc5e90e3b3Af64bdAF62C37EEFFCb` | Ethereum, Base, Arbitrum, OP Mainnet, Polygon, + others |

### Key Periphery Contracts (Ethereum)
| Contract | Address |
|----------|---------|
| Bundler3 | `0x6566194141eefa99Af43Bb5Aa71460Ca2Dc90245` |
| EthereumGeneralAdapter1 | `0x4A6c312ec70E8747a587EE860a0353cd42Be0aE0` |
| EthereumBundlerV2 | `0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077` |

### MORPHO Token
| Chain | Address |
|-------|---------|
| Ethereum | `0x58D97B57BB95320F9a05dC918Aef65434969c2B2` |

### Full Address Reference
[https://docs.morpho.org/get-started/resources/addresses/](https://docs.morpho.org/get-started/resources/addresses/)

---

## 4. Dune Analytics Dashboards

### High-Level
| Dashboard | URL |
|-----------|-----|
| GMorpho Dashboard | [dune.com/morpho/gmorpho-dashboard](https://dune.com/morpho/gmorpho-dashboard) |
| Morpho Protocol (Multichain) | [dune.com/morpho/multichain-activity](https://dune.com/morpho/multichain-activity) |
| Morpho Blue Dashboard | [dune.com/morpho/morpho-blue-dashboard](https://dune.com/morpho/morpho-blue-dashboard) |

### Domain-Specific
| Dashboard | URL |
|-----------|-----|
| Morpho Migrations | [dune.com/morpho/morpho-migration](https://dune.com/morpho/morpho-migration) |
| Coinbase On-Chain Lending | [dune.com/morpho/coinbase-onchain-lending-borrowing](https://dune.com/morpho/coinbase-onchain-lending-borrowing) |
| Vault Performance | [dune.com/morpho/single-vault-performance](https://dune.com/morpho/single-vault-performance) |
| Vault Curators | [dune.com/morpho/vaults-curators-analysis](https://dune.com/morpho/vaults-curators-analysis) |
| Credit Risk | [dune.com/morpho/morpho-credit-risk](https://dune.com/morpho/morpho-credit-risk) |
| Liquidations | [dune.com/morpho/morpho-liquidation](https://dune.com/morpho/morpho-liquidation) |
| Blue Efficiencies (community) | [dune.com/dreamlab/morpho-blue-efficiencies](https://dune.com/dreamlab/morpho-blue-efficiencies) |

---

## 5. Data Source Priority for Our Pipeline

1. **Morpho GraphQL API** — primary source. No auth needed, rich data, covers markets + vaults + positions + historical. Rate limit is generous (5k/5min).
2. **TheGraph Subgraphs** — fallback / cross-reference. Requires API key. Messari schema standardization is useful for cross-protocol comparisons.
3. **Direct RPC calls** — for real-time on-chain state when API latency matters (e.g., liquidation bots). Not needed for monitoring dashboards.
4. **Dune** — for visual exploration and ad-hoc analysis, not programmatic pipelines.
