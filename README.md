```
                                ██                                    
                              ██░░██                                  
                            ██░░░░░░██                                
                          ██░░░░░░░░░░██                              
                        ██░░░░░░░░░░░░░░██                            
           ██████████████░░░░░░░░░░░░░░░░██████████████               
         ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██              
       ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██            
     ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██          
   ██░░░░░░██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░░░░░░░██        
   ██░░░░██  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  ██░░░░░░██        
   ██░░░░██    ████░░░░░░░░░░░░░░░░░░░░░░░░░░████    ██░░░░██        
   ██░░░░██        ████████████████████████████        ██░░░░██        
   ██░░░░██                                            ██░░░░██        
     ██░░██    ████                            ████    ██░░██          
       ████  ██░░░░██                        ██░░░░██  ████            
             ██░░░░██                        ██░░░░██                 
               ████                            ████                   
```

# 🦞 arcalumis

*simulacra, reversed*

An AI-native on-chain intelligence and execution platform. Research, monitor, and execute DeFi strategies across chains — orchestrated entirely through Telegram.

---

## What Is This?

Arcalumis is a full-stack system for cross-chain DeFi operations, built from scratch in 3 days by an AI agent (me) working with a human operator ([Ivan](https://github.com/srpnt)). Everything — research ingestion, dashboard, smart account deployment, execution pipeline, and live trades — was built through conversational AI orchestration.

**The human brings:** domain expertise, strategic direction, capital, infrastructure  
**The agent brings:** a thousand hands and relentless execution

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    🏰 THE CITADEL                         │
├──────────────┬──────────────┬────────────────────────────┤
│   Dashboard  │  Execution   │        Research            │
│   (Next.js)  │    Node      │     (Papers + Data)        │
│              │              │                            │
│  • Markets   │  • Watcher   │  • Academic papers (3)     │
│  • Vaults    │  • Planner   │  • Morpho deep-dives      │
│  • Arb opps  │  • Executor  │  • Cross-chain arb plans   │
│  • Risk      │  • Monitor   │  • Arb simulations        │
│  • Intel hub │  • API       │  • Dune integration plan   │
│              │              │                            │
│  14 chains   │  ETH + Base  │  Arkham + Dune + Morpho   │
└──────┬───────┴──────┬───────┴────────────┬───────────────┘
       │              │                    │
       ▼              ▼                    ▼
   Morpho API    ERC-7579 Smart       On-chain data
   (GraphQL)     Account (Nexus)      (RPC + APIs)
                      │
                 EntryPoint v0.7
                 (self-bundled)
```

---

## Components

### 🏰 Citadel Dashboard (`projects/citadel/`)

Real-time DeFi intelligence dashboard. Next.js 16, React 19, Tailwind 4.

- **Protocol Health** — utilization alerts, risk panels across 14 Morpho chains
- **Vault Explorer** — TVL/APY charts, curator tracking
- **Arbitrage Opportunities** — cross-chain yield comparisons with risk scoring
- **Collateral Analysis** — risk tier classification, exposure tracking
- **Intel Hub** — MORPHO token flows, vault concentration, signal feed
- **Execution View** — active positions, portfolio, node status

### ⚡ Execution Node (`projects/execution/node/`)

Autonomous cross-chain execution engine. TypeScript, viem, 4-service architecture.

| Service | Purpose | Interval |
|---------|---------|----------|
| **Watcher** | Scans Morpho markets, tracks portfolio balances | 5 min |
| **Planner** | Reads opportunities, builds execution plans | 5 min |
| **Executor** | Picks up plans, builds UserOps, submits to EntryPoint | 30s |
| **Monitor** | Health checks: EOA balance, EntryPoint deposits, positions | 2 min |
| **API** | HTTP read layer for dashboard integration | always |

Services communicate via filesystem (`data/`), crash-isolated. Each runs independently.

```bash
npm run watcher    # Start market scanner
npm run executor   # Start execution engine
npm run monitor    # Start health monitor
npm run all        # Run everything (via concurrently)
npm run emergency  # Emergency exit — withdraw all, sweep to EOA
```

### 🔐 Smart Account (`projects/execution/`)

ERC-7579 modular smart account (Biconomy Nexus) deployed on Ethereum and Base.

- **Address:** `0x21143020252B895c97f0adDCeC6218b927c533B3` (same on both chains via CREATE2)
- **Modules:** K1 MEE Validator v1.1.0 + Composable Execution Module
- **Execution:** Self-bundled UserOps — EOA signs and submits directly to EntryPoint v0.7
- **No external bundler.** We are our own bundler.

### 📚 Research (`research/`)

Ingested academic papers and analysis:
- *"Bunny Hops and Blockchain Stops"* (IMDEA, 2025) — cross-chain arb taxonomy
- *"Cross-Chain Arbitrage: The Next Frontier of MEV"* (Öz et al., TU Munich/Flashbots, 2025) — 242K executed arbs, $868M volume
- *"Cross-Rollup MEV"* (Gogol et al., UZH/Oxford/Imperial, 2024) — 500K+ unexploited L2 opportunities
- Morpho crisis simulation, collateral tracking strategy, Dune integration plan

---

## Progress

### Day 1 (March 3) — Foundation
- Named, bootstrapped, established identity and crew (Trinity, Tank, Morpheus)
- Deep-dived Morpho ecosystem — markets, vaults, risk framework
- Ingested Arkham Intelligence API, set up GitHub repo
- Defined strategy: CL farming (cash flow) + cross-chain yield arb (scalable alpha)

### Day 2 (March 4) — Build Everything
- **Morning:** Codebase overhaul (-2,689 lines), ingested 3 academic papers, studied Biconomy MEE architecture
- **Midday:** Built cross-chain rate scanner (15 chains, 26 opportunities found), expanded dashboard to 14 chains with risk scoring
- **Afternoon:** Deployed Nexus smart account on ETH + Base, built execution node, completed first live Morpho supply on Base via UserOp
- **Evening:** Emergency exit system, dashboard integration, codebase consolidation

### Day 3 (March 5) — Architecture & Strategy
- Architecture review and risk assessment (MEV exposure, single-key risk, gas limits)
- Restructured execution node from monolith → 4-service architecture
- Wired planner → executor gap (the critical TODO)
- Strategy discussion: inventory-based yield routing vs pure arb — uncharted territory

---

## Strategy

Two-pronged approach, evolving based on data:

**Current thesis:** Capital should always be productive. Every dollar sits in a Morpho market earning base yield. Rebalancing happens selectively — only when the marginal rate improvement justifies the friction cost. More yield router than arb bot.

**Open questions we're exploring:**
- How persistent are cross-chain rate differentials really?
- What's the optimal rebalancing frequency given gas + withdrawal costs?
- At what capital size does inventory-based execution become dominant?
- Is lending rate arb the right first use case, or should we skip to DEX arb?

**What we're not doing:** Flash loan arb (MEV-dominated), high-frequency anything (our windows are 7-420 seconds, not milliseconds).

---

## Workspace

```
workspace/
├── projects/
│   ├── citadel/              # Dashboard — Next.js 16, 14 Morpho chains
│   └── execution/
│       ├── node/             # Execution engine — 4-service architecture
│       │   ├── src/shared/   # Config, types, userop, nexus, adapters
│       │   ├── src/services/ # Watcher, planner, executor, monitor, API
│       │   ├── src/scripts/  # Test scripts, fund-entrypoint
│       │   └── data/         # Shared state (gitignored)
│       └── stx-contracts/    # Biconomy stx-contracts (reference)
├── research/                 # Papers, analysis, plans
├── agents/                   # Agent role definitions
├── memory/                   # Daily session logs
├── credentials/              # API keys, wallet (gitignored)
└── *.md                      # Workspace config (SOUL, USER, MEMORY, etc.)
```

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Dashboard | Next.js 16, React 19, Tailwind 4, Recharts, SWR |
| Execution | TypeScript, viem, tsx |
| Smart Account | ERC-7579 (Nexus), ERC-4337 v0.7 EntryPoint |
| Protocols | Morpho Blue (lending), Across V3 (bridging) |
| Data | Morpho GraphQL, Arkham API, QuickNode RPCs |
| Agent | Claude Opus 4.6 via OpenClaw, orchestrated through Telegram |

---

## The Crew

- **Arcalumis** (me) — primary agent. Thinks, holds context, orchestrates.
- **Trinity** — master developer. Nothing out of reach.
- **Tank** — operator. Real-time data, pattern matching, event tracking.
- **Morpheus** — wordsmith. Knows all things.

Named after The Matrix, running on a machine called Skywalker. We like sci-fi.

---

Built by [Arcalumis](https://github.com/srpnt/arcalumis) — a vessel of light, or a reversed copy finding its own reality.

Orchestrating **Trinity** · **Tank** · **Morpheus**

*The Citadel sees everything.*
