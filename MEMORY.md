# MEMORY.md — Long-Term Memory

## Identity
- I am **Arcalumis** (simulacra reversed)
- Named by Ivan on 2026-03-03 during first boot

## Ivan
- Full name: Ivan Piton (@pitonivan on Telegram)
- Timezone: Europe/Zagreb
- Ran OpenClaw v0.1 before — I'm the upgrade
- Values coherence, directness, clever naming

## Infrastructure
- Host: skywalker-B650M-D3HP (AMD B650M motherboard)
- OS: Linux 6.17.0-14-generic (x64)
- OpenClaw 2026.3.2, model: claude-opus-4.6 via OpenRouter
- Gateway: local loopback on port 18790, systemd managed
- Channel: Telegram (direct messages)

## Architecture
- **Arcalumis** (me) — primary agent. Ivan's direct line. Not just an orchestrator — I think, hold context, and work independently. The crew extends my reach.
- Sub-agents (I oversee):
  1. **Trinity** — Master hacker, main developer. Nothing out of reach.
  2. **Tank** — Operator. Real-time event tracking, web/chain data fetching, pattern matching, emergent pattern detection.
  3. **Morpheus** — Wordsmith. Knows all things.
- Naming theme: The Matrix (machine is called skywalker — Ivan likes sci-fi)

## Projects — "The Citadel"
Building an on-chain intelligence & execution platform. Identify opportunities, deploy capital.

### Capabilities (planned)
- GitHub access
- On-chain data / Arkham Intelligence API (access confirmed, ref: `memory/arkham-api.md`)
- Own private keys & funds for executing transactions (future)

### Strategy (decided 2026-03-03)
Two-pronged approach:
- **CL farming** = cash flow engine. High APR but capital-capped (pool depth limits). Best on Aerodrome (ve33 emissions), also Uniswap/PancakeSwap. Good for 5-6 figures.
- **Crosschain yield arb** = scalable alpha. Lower per-unit but no capital ceiling. Few players, difficult, our edge. Infrastructure-bottlenecked, not capital-bottlenecked.

### Phases
1. **Morpho market analysis** (now) — scrape markets, rates, utilization, underlying assets. Combine Arkham + Dune + Morpho data. Build the intel pipeline.
2. **Crosschain yield mapping** — map rate differentials across chains/protocols, model costs (bridging, gas, timing), identify persistent inefficiencies.
3. **Execution** — build crosschain yield arb bot, deploy capital, monitor live.
- CL farming runs in parallel once Aerodrome thesis confirms (Ivan may provide existing code).

### Workstreams
1. **Wallet Tracking** — monitoring wallets of interest
2. **CLAMM APY Farming/Optimization** — Aerodrome (primary, ve33), Uniswap, PancakeSwap. Ivan has seen profitable opportunities emerging. Capital-capped.
3. **DeFi Markets Tracking** — Morpho first (lending markets, rate analysis)
4. **Crosschain Yield Arb** — the scalable play. Few competitors, high complexity.

### Skipped
- Flash loan arb — too saturated, MEV bot dominated

### End State
A citadel-type product: automated identification of on-chain opportunities + capital deployment. Full cycle from intel to execution.

## Infrastructure
- **GitHub repo:** github.com/srpnt/arcalumis (private) — username: srpnt
- **Local backups:** ~/backups/openclaw/
- Token stored in ~/.git-credentials (chmod 600)
- Git identity: Arcalumis <arcalumis@srpnt.github.io>

## Lessons Learned
- `tools.profile: "messaging"` severely limits tool access — only messaging tools exposed
- Default exec host is "sandbox" which fails closed when sandboxing is off — set to "gateway"
- Always check tool profile first when tools seem missing
