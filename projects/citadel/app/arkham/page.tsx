"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUsd, formatAddress } from "@/lib/format";

// ============================================================
// Types
// ============================================================

interface CuratorInfo {
  name: string;
  searchQuery: string;
  description: string;
}

interface CuratorResult {
  name: string;
  entityId: string | null;
  arkhamName: string | null;
  addresses: string[];
  labels: string[];
  portfolioValue: number | null;
  website: string | null;
  twitter: string | null;
  loading: boolean;
  error: string | null;
}

interface WhaleEntry {
  address: string;
  entityName: string | null;
  holdings: number;
  percentage: number;
  valueUsd: number;
}

interface LookupResult {
  entity: {
    name: string;
    type: string;
    labels: string[];
    website?: string;
    twitter?: string;
  } | null;
  totalUsd: number;
  transfers: Array<{
    time: string;
    from: string;
    to: string;
    token: string;
    valueUsd: number;
    txHash: string;
  }>;
}

// ============================================================
// Constants
// ============================================================

const CURATORS: CuratorInfo[] = [
  { name: "Gauntlet", searchQuery: "Gauntlet", description: "Risk management & optimization" },
  { name: "Steakhouse Financial", searchQuery: "Steakhouse", description: "Institutional-grade treasury management" },
  { name: "MEV Capital", searchQuery: "MEV Capital", description: "MEV-focused vault strategies" },
  { name: "Block Analitica / B.Protocol", searchQuery: "Block Analitica", description: "Risk analytics & liquidation management" },
  { name: "RE7 Capital", searchQuery: "RE7", description: "DeFi-native capital allocation" },
  { name: "Moonwell", searchQuery: "Moonwell", description: "Base-native lending optimization" },
];

const PROXY_BASE = "/api/arkham";

// ============================================================
// API Helpers
// ============================================================

async function arkhamGet(path: string, params?: Record<string, string>) {
  let url = `${PROXY_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url = `${url}?${qs}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Arkham ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function searchEntity(query: string): Promise<{
  entityId: string | null;
  name: string | null;
  addresses: string[];
  labels: string[];
  website: string | null;
  twitter: string | null;
}> {
  try {
    const data = await arkhamGet("/intelligence/search", { query });
    // Arkham search can return different shapes
    const results = Array.isArray(data) ? data : data?.results || data?.entities || [];
    if (results.length === 0) {
      return { entityId: null, name: null, addresses: [], labels: [], website: null, twitter: null };
    }
    const entity = results[0];
    const id = entity.id || entity.entityId || entity.slug || null;
    const addresses = Array.isArray(entity.addresses)
      ? entity.addresses.map((a: { address?: string } | string) => typeof a === "string" ? a : a.address || "").filter(Boolean)
      : entity.address
        ? [entity.address]
        : [];
    const labels = Array.isArray(entity.tags) ? entity.tags : Array.isArray(entity.labels) ? entity.labels : [];
    return {
      entityId: id,
      name: entity.name || entity.label || query,
      addresses,
      labels,
      website: entity.website || null,
      twitter: entity.twitter || null,
    };
  } catch {
    return { entityId: null, name: null, addresses: [], labels: [], website: null, twitter: null };
  }
}

// ============================================================
// Component: Curator Card
// ============================================================

function CuratorCard({ curator, result }: { curator: CuratorInfo; result: CuratorResult }) {
  const arkhamUrl = result.entityId
    ? `https://platform.arkhamintelligence.com/explorer/entity/${result.entityId}`
    : result.addresses.length > 0
      ? `https://platform.arkhamintelligence.com/explorer/address/${result.addresses[0]}`
      : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">
            {curator.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{curator.description}</p>
        </div>
        {result.loading ? (
          <div className="w-5 h-5 border-2 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
        ) : result.error ? (
          <span className="text-xs text-red-400" title={result.error}>⚠️</span>
        ) : (
          <span className="text-xs text-emerald-500">●</span>
        )}
      </div>

      {!result.loading && !result.error && (
        <>
          {/* Arkham entity name if different */}
          {result.arkhamName && result.arkhamName !== curator.name && (
            <p className="text-xs text-gray-400 mb-2">
              Arkham: <span className="text-gray-300">{result.arkhamName}</span>
            </p>
          )}

          {/* Labels */}
          {result.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.labels.slice(0, 5).map((label, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] bg-gray-800 border border-gray-700 text-gray-400 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Addresses */}
          {result.addresses.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Known Addresses</p>
              <div className="flex flex-col gap-1">
                {result.addresses.slice(0, 3).map((addr, i) => (
                  <a
                    key={i}
                    href={`https://etherscan.io/address/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
                  >
                    {formatAddress(addr)}
                  </a>
                ))}
                {result.addresses.length > 3 && (
                  <span className="text-[10px] text-gray-600">+{result.addresses.length - 3} more</span>
                )}
              </div>
            </div>
          )}

          {/* Portfolio Value */}
          {result.portfolioValue !== null && result.portfolioValue > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Portfolio Value</p>
              <p className="text-lg font-bold text-gray-100">{formatUsd(result.portfolioValue)}</p>
            </div>
          )}

          {/* Social + Arkham Link */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-800/50">
            {result.website && (
              <a href={result.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
                🌐 Website
              </a>
            )}
            {result.twitter && (
              <a href={`https://twitter.com/${result.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
                𝕏 @{result.twitter.replace("@", "")}
              </a>
            )}
            {arkhamUrl && (
              <a href={arkhamUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors ml-auto">
                View on Arkham →
              </a>
            )}
          </div>
        </>
      )}

      {result.error && (
        <p className="text-xs text-red-400/70 mt-2">{result.error}</p>
      )}

      {!result.loading && !result.error && result.addresses.length === 0 && !result.entityId && (
        <p className="text-xs text-gray-600 mt-2">No entity data found on Arkham</p>
      )}
    </div>
  );
}

// ============================================================
// Component: Whale Table
// ============================================================

function WhaleTable({ whales, loading, error }: {
  whales: WhaleEntry[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading whale data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
        ⚠️ {error}
      </div>
    );
  }

  if (whales.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">No whale data available. The Arkham token holders endpoint may require a different approach.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity / Address</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Holdings</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Supply</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w, i) => (
              <tr key={w.address} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <div>
                    {w.entityName && (
                      <span className="text-gray-200 font-medium">{w.entityName}</span>
                    )}
                    <a
                      href={`https://etherscan.io/address/${w.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs font-mono text-gray-500 hover:text-emerald-400 transition-colors"
                    >
                      {formatAddress(w.address)}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                  {w.holdings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {w.percentage > 0 ? `${w.percentage.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-200">
                  {w.valueUsd > 0 ? formatUsd(w.valueUsd) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

type PageTab = "curators" | "whales" | "lookup";

export default function ArkhamPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("curators");

  // Curator state
  const [curatorResults, setCuratorResults] = useState<Map<string, CuratorResult>>(new Map());
  const [curatorsLoaded, setCuratorsLoaded] = useState(false);

  // Whale state
  const [whales, setWhales] = useState<WhaleEntry[]>([]);
  const [whalesLoading, setWhalesLoading] = useState(false);
  const [whalesError, setWhalesError] = useState<string | null>(null);
  const [whalesLoaded, setWhalesLoaded] = useState(false);

  // Lookup state
  const [lookupAddress, setLookupAddress] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // ---- Load curators ----
  const loadCurators = useCallback(async () => {
    if (curatorsLoaded) return;
    setCuratorsLoaded(true);

    // Initialize all as loading
    const initial = new Map<string, CuratorResult>();
    for (const c of CURATORS) {
      initial.set(c.name, {
        name: c.name,
        entityId: null,
        arkhamName: null,
        addresses: [],
        labels: [],
        portfolioValue: null,
        website: null,
        twitter: null,
        loading: true,
        error: null,
      });
    }
    setCuratorResults(new Map(initial));

    // Fetch each curator in parallel
    await Promise.all(
      CURATORS.map(async (curator) => {
        try {
          const searchResult = await searchEntity(curator.searchQuery);

          let portfolioValue: number | null = null;
          // Try to get portfolio for first address
          if (searchResult.addresses.length > 0) {
            try {
              const portData = await arkhamGet(`/portfolio/v2/${searchResult.addresses[0]}`);
              if (portData?.chains) {
                let total = 0;
                for (const chainData of Object.values(portData.chains)) {
                  if (typeof chainData !== "object" || chainData === null) continue;
                  for (const tokenInfo of Object.values(chainData as Record<string, unknown>)) {
                    if (typeof tokenInfo !== "object" || tokenInfo === null) continue;
                    const t = tokenInfo as Record<string, unknown>;
                    total += Number(t.usdValue || t.valueUsd || 0) || 0;
                  }
                }
                if (total > 0) portfolioValue = total;
              }
            } catch {
              // Portfolio fetch failed, that's OK
            }
          }

          setCuratorResults((prev) => {
            const next = new Map(prev);
            next.set(curator.name, {
              name: curator.name,
              entityId: searchResult.entityId,
              arkhamName: searchResult.name,
              addresses: searchResult.addresses,
              labels: searchResult.labels,
              portfolioValue,
              website: searchResult.website,
              twitter: searchResult.twitter,
              loading: false,
              error: null,
            });
            return next;
          });
        } catch (err) {
          setCuratorResults((prev) => {
            const next = new Map(prev);
            next.set(curator.name, {
              name: curator.name,
              entityId: null,
              arkhamName: null,
              addresses: [],
              labels: [],
              portfolioValue: null,
              website: null,
              twitter: null,
              loading: false,
              error: String(err),
            });
            return next;
          });
        }
      })
    );
  }, [curatorsLoaded]);

  // ---- Load whales ----
  const loadWhales = useCallback(async () => {
    if (whalesLoaded) return;
    setWhalesLoaded(true);
    setWhalesLoading(true);
    setWhalesError(null);

    try {
      // Try Arkham token holders endpoint
      let data: unknown;
      try {
        data = await arkhamGet("/token/holders/morpho");
      } catch {
        // Fallback: search for MORPHO token and try different paths
        try {
          data = await arkhamGet("/intelligence/search", { query: "MORPHO token" });
        } catch {
          data = null;
        }
      }

      const entries: WhaleEntry[] = [];

      if (data && typeof data === "object") {
        // Try to extract holders from various possible response shapes
        const holders = Array.isArray(data)
          ? data
          : (data as Record<string, unknown>)?.holders
            ? ((data as Record<string, unknown>).holders as unknown[])
            : (data as Record<string, unknown>)?.results
              ? ((data as Record<string, unknown>).results as unknown[])
              : [];

        if (Array.isArray(holders)) {
          for (const h of holders.slice(0, 20)) {
            if (typeof h !== "object" || h === null) continue;
            const holder = h as Record<string, unknown>;
            const addr = String(holder.address || holder.holderAddress || "");
            if (!addr) continue;

            const entity = holder.arkhamEntity || holder.entity;
            const entityName = entity && typeof entity === "object"
              ? String((entity as Record<string, unknown>).name || "")
              : typeof holder.label === "string"
                ? holder.label
                : null;

            entries.push({
              address: addr,
              entityName: entityName || null,
              holdings: Number(holder.balance || holder.amount || holder.quantity || 0),
              percentage: Number(holder.percentage || holder.share || 0),
              valueUsd: Number(holder.usdValue || holder.valueUsd || 0),
            });
          }
        }
      }

      setWhales(entries);
    } catch (err) {
      setWhalesError(String(err));
    } finally {
      setWhalesLoading(false);
    }
  }, [whalesLoaded]);

  // ---- Address Lookup ----
  const doLookup = async () => {
    const addr = lookupAddress.trim();
    if (!addr) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const [entityRes, portfolioRes, transfersRes] = await Promise.allSettled([
        arkhamGet(`/intelligence/address/${addr}`),
        arkhamGet(`/portfolio/v2/${addr}`),
        arkhamGet("/transfers", { base: addr, limit: "10", usdGte: "100" }),
      ]);

      // Parse entity
      let entity: LookupResult["entity"] = null;
      if (entityRes.status === "fulfilled" && entityRes.value) {
        const d = entityRes.value;
        const e = d.arkhamEntity || d;
        entity = {
          name: e.name || e.label || "Unknown",
          type: e.type || e.entityType || "—",
          labels: Array.isArray(e.tags) ? e.tags : Array.isArray(e.labels) ? e.labels : [],
          website: e.website,
          twitter: e.twitter,
        };
      }

      // Parse portfolio
      let totalUsd = 0;
      if (portfolioRes.status === "fulfilled" && portfolioRes.value?.chains) {
        for (const chainData of Object.values(portfolioRes.value.chains)) {
          if (typeof chainData !== "object" || chainData === null) continue;
          for (const tokenInfo of Object.values(chainData as Record<string, unknown>)) {
            if (typeof tokenInfo !== "object" || tokenInfo === null) continue;
            const t = tokenInfo as Record<string, unknown>;
            totalUsd += Number(t.usdValue || t.valueUsd || 0) || 0;
          }
        }
      }

      // Parse transfers
      const transfers: LookupResult["transfers"] = [];
      if (transfersRes.status === "fulfilled") {
        const items = Array.isArray(transfersRes.value)
          ? transfersRes.value
          : transfersRes.value?.transfers || [];
        for (const tx of items.slice(0, 10)) {
          if (typeof tx !== "object" || !tx) continue;
          const fromAddr = tx.fromAddress || {};
          const toAddr = tx.toAddress || {};
          transfers.push({
            time: (tx.blockTimestamp || tx.timestamp || "").slice(0, 19).replace("T", " ") || "—",
            from: typeof fromAddr === "object" ? fromAddr.arkhamEntity?.name || formatAddress(fromAddr.address || "") : formatAddress(String(fromAddr)),
            to: typeof toAddr === "object" ? toAddr.arkhamEntity?.name || formatAddress(toAddr.address || "") : formatAddress(String(toAddr)),
            token: typeof (tx.tokenInfo || tx.token) === "object" ? (tx.tokenInfo || tx.token)?.symbol || "?" : "?",
            valueUsd: Number(tx.unitValue || tx.historicalUSD || 0),
            txHash: tx.transactionHash || "",
          });
        }
      }

      setLookupResult({ entity, totalUsd, transfers });
    } catch (err) {
      setLookupError(String(err));
    } finally {
      setLookupLoading(false);
    }
  };

  // Auto-load data when tab switches
  useEffect(() => {
    if (activeTab === "curators") loadCurators();
    if (activeTab === "whales") loadWhales();
  }, [activeTab, loadCurators, loadWhales]);

  // ============================================================
  // Render
  // ============================================================

  const TABS: { key: PageTab; label: string; icon: string }[] = [
    { key: "curators", label: "Curator Tracker", icon: "🏛" },
    { key: "whales", label: "Whale Tracker", icon: "🐋" },
    { key: "lookup", label: "Address Lookup", icon: "🔍" },
  ];

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">🔍 Arkham Intel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Morpho curator & whale tracking — on-chain intelligence via Arkham
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 mb-8 bg-gray-900 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-gray-700 text-gray-100 font-medium"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* Section 1: Curator Tracker */}
      {/* ============================================================ */}
      {activeTab === "curators" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              Morpho Vault Curators
            </h2>
            <p className="text-xs text-gray-500">
              Tracking major Morpho vault curators via Arkham Intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {CURATORS.map((curator) => {
              const result = curatorResults.get(curator.name) || {
                name: curator.name,
                entityId: null,
                arkhamName: null,
                addresses: [],
                labels: [],
                portfolioValue: null,
                website: null,
                twitter: null,
                loading: true,
                error: null,
              };
              return (
                <CuratorCard
                  key={curator.name}
                  curator={curator}
                  result={result}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Section 2: Whale Tracker */}
      {/* ============================================================ */}
      {activeTab === "whales" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              🐋 MORPHO Token Whales
            </h2>
            <p className="text-xs text-gray-500">
              Top MORPHO token holders tracked via Arkham Intelligence
            </p>
          </div>

          <WhaleTable
            whales={whales}
            loading={whalesLoading}
            error={whalesError}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* Section 3: Address Lookup */}
      {/* ============================================================ */}
      {activeTab === "lookup" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              Address Lookup
            </h2>
            <p className="text-xs text-gray-500">
              Look up any Ethereum address for entity info, balances, and recent transfers
            </p>
          </div>

          {/* Search */}
          <div className="flex gap-2 mb-8">
            <input
              type="text"
              value={lookupAddress}
              onChange={(e) => setLookupAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLookup()}
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
            />
            <button
              onClick={doLookup}
              disabled={lookupLoading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {lookupLoading ? "..." : "🔍 Lookup"}
            </button>
          </div>

          {lookupError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
              ❌ {lookupError}
            </div>
          )}

          {lookupLoading && (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-pulse">Looking up address...</div>
            </div>
          )}

          {lookupResult && !lookupLoading && (
            <div className="space-y-4">
              {/* Entity Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Entity Info</h3>
                {lookupResult.entity ? (
                  <div>
                    <h4 className="text-xl font-bold text-gray-100">{lookupResult.entity.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {lookupResult.entity.type} •{" "}
                      <span className="font-mono text-xs">{formatAddress(lookupAddress)}</span>
                    </p>
                    {lookupResult.entity.labels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {lookupResult.entity.labels.map((label, i) => (
                          <span key={i}
                            className="px-3 py-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-4">
                      {lookupResult.entity.website && (
                        <a href={lookupResult.entity.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:underline">
                          🌐 {lookupResult.entity.website}
                        </a>
                      )}
                      {lookupResult.entity.twitter && (
                        <a href={`https://twitter.com/${lookupResult.entity.twitter.replace("@", "")}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:underline">
                          𝕏 @{lookupResult.entity.twitter.replace("@", "")}
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No entity data found — may be an unlabeled wallet.</p>
                )}

                {lookupResult.totalUsd > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500">Portfolio Value</p>
                    <p className="text-2xl font-bold text-gray-100 mt-1">{formatUsd(lookupResult.totalUsd)}</p>
                  </div>
                )}
              </div>

              {/* Transfers */}
              {lookupResult.transfers.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Recent Transfers
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lookupResult.transfers.map((t, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{t.time}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-xs">{t.from}</td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-xs">{t.to}</td>
                            <td className="px-4 py-3 text-gray-200 font-medium">{t.token}</td>
                            <td className="px-4 py-3 text-right text-gray-200 font-medium">
                              {t.valueUsd > 0 ? formatUsd(t.valueUsd) : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                              {t.txHash ? (
                                <a href={`https://etherscan.io/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer"
                                  className="hover:text-emerald-400">
                                  {t.txHash.slice(0, 10)}...
                                </a>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!lookupResult && !lookupLoading && !lookupError && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-4">🔍</p>
              <p className="text-sm">Enter an Ethereum address to look up entity info and activity</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
