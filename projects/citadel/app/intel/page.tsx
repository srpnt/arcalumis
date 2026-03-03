"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatUsd, formatAddress } from "@/lib/format";

// ============================================================
// Types
// ============================================================

interface CuratorVault {
  address: string;
  name: string;
  chainId: number;
  chainNetwork: string;
  assetSymbol: string;
  totalAssetsUsd: number;
  netApy: number;
}

interface CuratorData {
  id: string;
  name: string;
  description: string | null;
  verified: boolean;
  image: string | null;
  addresses: { chainId: number; address: string }[];
  aum: number;
  socials: { type: string; url: string }[];
  vaults: CuratorVault[];
  vaultsLoading: boolean;
  // Enriched from Arkham
  intelEntity: {
    name: string;
    id: string;
    labels: string[];
    website: string | null;
    twitter: string | null;
  } | null;
  intelLoading: boolean;
}

interface WhaleEntry {
  address: string;
  entityName: string | null;
  entityId: string | null;
  labels: string[];
  holdings: number;
  percentage: number;
  valueUsd: number;
  isContract: boolean;
}

interface VaultWhaleEntry {
  rank: number;
  userAddress: string;
  vaultName: string;
  vaultAddress: string;
  chainId: number;
  chainNetwork: string;
  depositedUsd: number;
  depositedAssets: string;
  assetSymbol: string;
  assetDecimals: number;
  // Enriched
  entityName: string | null;
  entityId: string | null;
  intelLoading: boolean;
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

const MORPHO_TOKEN = "0x9994E35Db50125E0DF82e4c2dde62496CE330999";
const PROXY_BASE = "/api/intel";
const MORPHO_GQL = "/api/morpho";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  10: "Optimism",
  42161: "Arbitrum",
  137: "Polygon",
  130: "Unichain",
};

const CHAIN_COLORS: Record<number, string> = {
  1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  8453: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  10: "bg-red-500/20 text-red-400 border-red-500/30",
  42161: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  137: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const KNOWN_ENTITIES: Record<string, { color: string }> = {
  "morpho": { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  "coinbase": { color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "a16z": { color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "apollo": { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  "binance": { color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

// ============================================================
// API Helpers
// ============================================================

async function intelGet(path: string, params?: Record<string, string>) {
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

async function morphoQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(MORPHO_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Morpho API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.errors) {
    throw new Error(`GraphQL: ${data.errors[0]?.message || JSON.stringify(data.errors)}`);
  }
  return data.data;
}

function getEtherscanUrl(address: string, chainId: number = 1): string {
  switch (chainId) {
    case 8453: return `https://basescan.org/address/${address}`;
    case 10: return `https://optimistic.etherscan.io/address/${address}`;
    case 42161: return `https://arbiscan.io/address/${address}`;
    case 137: return `https://polygonscan.com/address/${address}`;
    default: return `https://etherscan.io/address/${address}`;
  }
}

function getEntityBadgeColor(entityName: string | null): string | null {
  if (!entityName) return null;
  const lower = entityName.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_ENTITIES)) {
    if (lower.includes(key)) return val.color;
  }
  return null;
}

// ============================================================
// Component: Curator Card (Morpho API data, enriched with Arkham)
// ============================================================

function CuratorVaultRow({ vault }: { vault: CuratorVault }) {
  const chainColor = CHAIN_COLORS[vault.chainId] || "bg-gray-800 text-gray-400 border-gray-700";
  const morphoUrl = `https://app.morpho.org/vault?vault=${vault.address}&network=${vault.chainNetwork}`;
  const apyDisplay = vault.netApy > 0 ? `${(vault.netApy * 100).toFixed(2)}%` : "—";

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      <a
        href={morphoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-300 hover:text-emerald-400 transition-colors truncate min-w-0 flex-1"
        title={vault.name}
      >
        {vault.name}
      </a>
      <span className={`px-1 py-0.5 text-[9px] rounded border shrink-0 ${chainColor}`}>
        {CHAIN_NAMES[vault.chainId]?.slice(0, 3) || "?"}
      </span>
      <span className="text-gray-500 shrink-0 w-10 text-right font-mono">{vault.assetSymbol}</span>
      <span className="text-gray-300 shrink-0 w-16 text-right font-mono">{formatUsd(vault.totalAssetsUsd)}</span>
      <span className={`shrink-0 w-14 text-right font-mono ${vault.netApy > 0.05 ? "text-emerald-400" : "text-gray-400"}`}>{apyDisplay}</span>
    </div>
  );
}

function CuratorCard({ curator }: { curator: CuratorData }) {
  const [vaultsOpen, setVaultsOpen] = useState(false);

  const ethAddresses = curator.addresses
    .filter((a) => a.chainId === 1 || a.chainId === 8453)
    .reduce((acc, a) => {
      if (!acc.find((x) => x.address.toLowerCase() === a.address.toLowerCase())) acc.push(a);
      return acc;
    }, [] as { chainId: number; address: string }[]);

  const websiteUrl =
    curator.intelEntity?.website ||
    curator.socials.find((s) => s.type === "url")?.url ||
    null;
  const twitterUrl = curator.socials.find((s) => s.type === "twitter")?.url || null;
  const forumUrl = curator.socials.find((s) => s.type === "forum")?.url || null;

  const intelUrl = curator.intelEntity?.id
    ? `https://platform.intelintelligence.com/explorer/entity/${curator.intelEntity.id}`
    : ethAddresses.length > 0
      ? `https://platform.intelintelligence.com/explorer/address/${ethAddresses[0].address}`
      : null;

  const sortedVaults = [...curator.vaults].sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {curator.image && (
            <img
              src={curator.image}
              alt={curator.name}
              className="w-8 h-8 rounded-full bg-gray-800"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
              {curator.name}
              {curator.verified && (
                <span className="text-emerald-500 text-xs" title="Verified">✓</span>
              )}
            </h3>
            {curator.description && (
              <p className="text-xs text-gray-500 mt-0.5">{curator.description}</p>
            )}
          </div>
        </div>
        {curator.intelLoading ? (
          <div className="w-4 h-4 border-2 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
        ) : (
          <span className="text-xs text-emerald-500">●</span>
        )}
      </div>

      {/* AUM */}
      {curator.aum > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">AUM (Morpho Vaults)</p>
          <p className="text-lg font-bold text-gray-100">{formatUsd(curator.aum)}</p>
        </div>
      )}

      {/* Arkham entity info */}
      {curator.intelEntity && (
        <div className="mb-3">
          {curator.intelEntity.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {curator.intelEntity.labels.slice(0, 5).map((label, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] bg-gray-800 border border-gray-700 text-gray-400 rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Addresses */}
      {ethAddresses.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">Addresses</p>
          <div className="flex flex-col gap-1">
            {ethAddresses.slice(0, 4).map((addr, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[9px] rounded border ${CHAIN_COLORS[addr.chainId] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
                  {CHAIN_NAMES[addr.chainId] || `Chain ${addr.chainId}`}
                </span>
                <a
                  href={getEtherscanUrl(addr.address, addr.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
                >
                  {formatAddress(addr.address)}
                </a>
              </div>
            ))}
            {ethAddresses.length > 4 && (
              <span className="text-[10px] text-gray-600">+{ethAddresses.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Vaults Section */}
      {(curator.vaults.length > 0 || curator.vaultsLoading) && (
        <div className="mb-3 border-t border-gray-800/50 pt-2">
          <button
            onClick={() => setVaultsOpen(!vaultsOpen)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition-colors w-full text-left"
          >
            <span className="transition-transform duration-200" style={{ display: 'inline-block', transform: vaultsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▸
            </span>
            {curator.vaultsLoading ? (
              <span className="animate-pulse">Loading vaults...</span>
            ) : (
              <span>Vaults ({curator.vaults.length})</span>
            )}
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: vaultsOpen ? `${Math.max(sortedVaults.length * 32 + 16, 48)}px` : '0px',
              opacity: vaultsOpen ? 1 : 0,
            }}
          >
            <div className="mt-2 space-y-0">
              {sortedVaults.map((vault) => (
                <CuratorVaultRow key={`${vault.address}-${vault.chainId}`} vault={vault} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-800/50 flex-wrap">
        {websiteUrl && (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
            🌐 Website
          </a>
        )}
        {twitterUrl && (
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
            𝕏 Twitter
          </a>
        )}
        {forumUrl && (
          <a href={forumUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">
            💬 Forum
          </a>
        )}
        {intelUrl && (
          <a href={intelUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors ml-auto">
            Arkham →
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Component: Token Whale Table
// ============================================================

function TokenWhaleTable({ whales, loading, error }: {
  whales: WhaleEntry[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading MORPHO token holders...</div>
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
        <p className="text-sm">No token holder data available.</p>
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
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Holdings (MORPHO)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Supply</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">USD Value</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w, i) => {
              const badgeColor = getEntityBadgeColor(w.entityName);
              return (
                <tr key={w.address} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        {w.entityName && (
                          <span className={`inline-flex items-center gap-1 text-sm font-medium ${badgeColor ? "" : "text-gray-200"}`}>
                            {badgeColor ? (
                              <span className={`px-2 py-0.5 rounded-md border text-xs ${badgeColor}`}>
                                {w.entityName}
                              </span>
                            ) : (
                              w.entityName
                            )}
                          </span>
                        )}
                        <a
                          href={`https://etherscan.io/address/${w.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs font-mono text-gray-500 hover:text-emerald-400 transition-colors"
                        >
                          {formatAddress(w.address)}
                        </a>
                        {w.isContract && (
                          <span className="text-[10px] text-gray-600">📄 contract</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                    {w.holdings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {w.percentage > 0 ? `${w.percentage.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-200 text-xs">
                    {w.valueUsd > 0 ? formatUsd(w.valueUsd) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Component: Vault Whale Table
// ============================================================

function VaultWhaleTable({ whales, loading, error }: {
  whales: VaultWhaleEntry[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading vault depositor data...</div>
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
        <p className="text-sm">No vault position data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vault</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Chain</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deposited (USD)</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Asset</th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w) => {
              const chainColor = CHAIN_COLORS[w.chainId] || "bg-gray-800 text-gray-400 border-gray-700";
              return (
                <tr key={`${w.userAddress}-${w.vaultAddress}-${w.chainId}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-3 py-3 text-gray-500 text-xs">{w.rank}</td>
                  <td className="px-3 py-3">
                    <div>
                      {w.entityName && !w.intelLoading && (
                        <span className="text-xs font-medium text-gray-200 block">
                          {w.entityId ? (
                            <a
                              href={`https://platform.intelintelligence.com/explorer/entity/${w.entityId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-emerald-400 transition-colors"
                            >
                              {w.entityName}
                            </a>
                          ) : (
                            w.entityName
                          )}
                        </span>
                      )}
                      {w.intelLoading && (
                        <span className="text-[10px] text-gray-600 animate-pulse">looking up...</span>
                      )}
                      <a
                        href={getEtherscanUrl(w.userAddress, w.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-gray-500 hover:text-emerald-400 transition-colors"
                      >
                        {formatAddress(w.userAddress)}
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-300">{w.vaultName}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 text-[10px] rounded-md border ${chainColor}`}>
                      {CHAIN_NAMES[w.chainId] || `${w.chainId}`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-200 text-xs">
                    {formatUsd(w.depositedUsd)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-400 text-xs font-mono">
                    {w.assetSymbol}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

type PageTab = "curators" | "tokenWhales" | "vaultWhales" | "lookup";

export default function IntelPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("curators");

  // Curator state
  const [curators, setCurators] = useState<CuratorData[]>([]);
  const [curatorsLoading, setCuratorsLoading] = useState(false);
  const [curatorsError, setCuratorsError] = useState<string | null>(null);
  const curatorsLoaded = useRef(false);

  // Token whale state
  const [tokenWhales, setTokenWhales] = useState<WhaleEntry[]>([]);
  const [tokenWhalesLoading, setTokenWhalesLoading] = useState(false);
  const [tokenWhalesError, setTokenWhalesError] = useState<string | null>(null);
  const tokenWhalesLoaded = useRef(false);

  // Vault whale state
  const [vaultWhales, setVaultWhales] = useState<VaultWhaleEntry[]>([]);
  const [vaultWhalesLoading, setVaultWhalesLoading] = useState(false);
  const [vaultWhalesError, setVaultWhalesError] = useState<string | null>(null);
  const vaultWhalesLoaded = useRef(false);

  // Lookup state
  const [lookupAddress, setLookupAddress] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Whale watchlist count
  const [whaleCount, setWhaleCount] = useState<number | null>(null);

  // ---- Load curators from Morpho API, enrich with Arkham ----
  const loadCurators = useCallback(async () => {
    if (curatorsLoaded.current) return;
    curatorsLoaded.current = true;
    setCuratorsLoading(true);
    setCuratorsError(null);

    try {
      const data = await morphoQuery(`{
        curators(first: 50) {
          items {
            id
            name
            description
            verified
            image
            addresses { chainId address }
            state { aum }
            socials { type url }
          }
        }
      }`);

      const items = data?.curators?.items || [];
      // Sort by AUM descending
      const sorted = items
        .map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          description: c.description as string | null,
          verified: c.verified as boolean,
          image: c.image as string | null,
          addresses: (c.addresses as { chainId: number; address: string }[]) || [],
          aum: (c.state as { aum: number })?.aum || 0,
          socials: (c.socials as { type: string; url: string }[]) || [],
          vaults: [] as CuratorVault[],
          vaultsLoading: true,
          intelEntity: null,
          intelLoading: true,
        }))
        .sort((a: CuratorData, b: CuratorData) => b.aum - a.aum)
        .filter((c: CuratorData) => c.aum > 0); // Only show curators with AUM

      setCurators(sorted);
      setCuratorsLoading(false);

      // Fetch vaults for all curators in one query using curatorAddress_in
      try {
        // Collect all unique curator addresses (lowercase for matching)
        const allCuratorAddrs: string[] = [];
        for (const c of sorted) {
          for (const a of c.addresses) {
            const lower = a.address.toLowerCase();
            if (!allCuratorAddrs.includes(lower)) allCuratorAddrs.push(a.address);
          }
        }

        if (allCuratorAddrs.length > 0) {
          const vaultData = await morphoQuery(`
            query CuratorVaults($addrs: [String!]!) {
              vaults(
                first: 500
                where: { curatorAddress_in: $addrs, chainId_in: [1, 8453] }
                orderBy: TotalAssetsUsd
                orderDirection: Desc
              ) {
                items {
                  address
                  name
                  chain { id network }
                  asset { symbol }
                  state { totalAssetsUsd netApy curator }
                }
              }
            }
          `, { addrs: allCuratorAddrs });

          const vaultItems = vaultData?.vaults?.items || [];

          // Build a map: curatorAddress (lower) -> CuratorVault[]
          const curatorVaultMap: Record<string, CuratorVault[]> = {};
          for (const v of vaultItems) {
            const curatorAddr = (v.state?.curator || "").toLowerCase();
            if (!curatorVaultMap[curatorAddr]) curatorVaultMap[curatorAddr] = [];
            curatorVaultMap[curatorAddr].push({
              address: v.address,
              name: v.name || "Unnamed Vault",
              chainId: Number(v.chain?.id || 1),
              chainNetwork: String(v.chain?.network || "ethereum"),
              assetSymbol: String(v.asset?.symbol || "?"),
              totalAssetsUsd: Number(v.state?.totalAssetsUsd || 0),
              netApy: Number(v.state?.netApy || 0),
            });
          }

          // Map vaults to curators by matching curator addresses
          setCurators((prev) =>
            prev.map((c) => {
              const curatorAddrsLower = c.addresses.map((a) => a.address.toLowerCase());
              const vaults: CuratorVault[] = [];
              for (const addr of curatorAddrsLower) {
                if (curatorVaultMap[addr]) {
                  for (const v of curatorVaultMap[addr]) {
                    if (!vaults.find((x) => x.address.toLowerCase() === v.address.toLowerCase() && x.chainId === v.chainId)) {
                      vaults.push(v);
                    }
                  }
                }
              }
              return { ...c, vaults, vaultsLoading: false };
            })
          );
        } else {
          setCurators((prev) => prev.map((c) => ({ ...c, vaultsLoading: false })));
        }
      } catch {
        // Vault fetch failed — not critical, just mark as done
        setCurators((prev) => prev.map((c) => ({ ...c, vaultsLoading: false })));
      }

      // Enrich with Arkham data — look up first Ethereum address for each
      for (const curator of sorted) {
        const ethAddr = curator.addresses.find((a: { chainId: number; address: string }) => a.chainId === 1)?.address
          || curator.addresses[0]?.address;
        if (!ethAddr) {
          setCurators((prev) =>
            prev.map((c) => c.id === curator.id ? { ...c, intelLoading: false } : c)
          );
          continue;
        }

        try {
          const addrData = await intelGet(`/intelligence/address/${ethAddr}`);
          const entity = addrData?.intelEntity || null;
          setCurators((prev) =>
            prev.map((c) =>
              c.id === curator.id
                ? {
                    ...c,
                    intelLoading: false,
                    intelEntity: entity
                      ? {
                          name: entity.name || "",
                          id: entity.id || entity.slug || "",
                          labels: Array.isArray(entity.tags) ? entity.tags : [],
                          website: entity.website || null,
                          twitter: entity.twitter || null,
                        }
                      : null,
                  }
                : c
            )
          );
        } catch {
          setCurators((prev) =>
            prev.map((c) => c.id === curator.id ? { ...c, intelLoading: false } : c)
          );
        }
      }
    } catch (err) {
      setCuratorsError(String(err));
      setCuratorsLoading(false);
    }
  }, []);

  // ---- Load MORPHO token whales from Arkham ----
  const loadTokenWhales = useCallback(async () => {
    if (tokenWhalesLoaded.current) return;
    tokenWhalesLoaded.current = true;
    setTokenWhalesLoading(true);
    setTokenWhalesError(null);

    try {
      const data = await intelGet(`/token/holders/ethereum/${MORPHO_TOKEN}`);

      const totalSupply = data?.totalSupply?.ethereum || 1_000_000_000;
      const holders = data?.addressTopHolders?.ethereum || [];

      // Try to get MORPHO price from CoinGecko
      let morphoPrice = 0;
      try {
        const priceRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=morpho&vs_currencies=usd"
        );
        const priceData = await priceRes.json();
        morphoPrice = priceData?.morpho?.usd || 0;
      } catch {
        // Price fetch failed, we'll show "—" for USD
      }

      const entries: WhaleEntry[] = holders.slice(0, 50).map((h: Record<string, unknown>) => {
        const addrInfo = h.address as Record<string, unknown> || {};
        const addr = String(addrInfo.address || "");
        const balance = Number(h.balance || 0);
        const entity = addrInfo.intelEntity as Record<string, unknown> | null;
        const label = addrInfo.intelLabel as Record<string, unknown> | null;

        return {
          address: addr,
          entityName: entity?.name as string || label?.name as string || null,
          entityId: entity?.id as string || null,
          labels: [],
          holdings: balance,
          percentage: (balance / totalSupply) * 100,
          valueUsd: morphoPrice > 0 ? balance * morphoPrice : (Number(h.usd) || 0),
          isContract: Boolean(addrInfo.contract),
        };
      });

      setTokenWhales(entries);
    } catch (err) {
      setTokenWhalesError(String(err));
    } finally {
      setTokenWhalesLoading(false);
    }
  }, []);

  // ---- Load vault whales from Morpho GraphQL ----
  const loadVaultWhales = useCallback(async () => {
    if (vaultWhalesLoaded.current) return;
    vaultWhalesLoaded.current = true;
    setVaultWhalesLoading(true);
    setVaultWhalesError(null);

    try {
      const data = await morphoQuery(`
        query TopVaultDepositors {
          vaultPositions(
            first: 50
            orderBy: Shares
            orderDirection: Desc
            where: { chainId_in: [1, 8453] }
          ) {
            items {
              state {
                assetsUsd
                assets
              }
              user {
                address
                tag
              }
              vault {
                name
                address
                chain { id network }
                asset { symbol decimals priceUsd }
              }
            }
          }
        }
      `);

      const items = data?.vaultPositions?.items || [];

      // Sort by assetsUsd descending (API sorts by Shares which may differ)
      const sorted = [...items].sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) => {
          const aUsd = (a.state as Record<string, unknown>)?.assetsUsd as number || 0;
          const bUsd = (b.state as Record<string, unknown>)?.assetsUsd as number || 0;
          return bUsd - aUsd;
        }
      );

      const entries: VaultWhaleEntry[] = sorted.map(
        (item: Record<string, unknown>, i: number) => {
          const state = item.state as Record<string, unknown> || {};
          const user = item.user as Record<string, unknown> || {};
          const vault = item.vault as Record<string, unknown> || {};
          const chain = vault.chain as Record<string, unknown> || {};
          const asset = vault.asset as Record<string, unknown> || {};

          return {
            rank: i + 1,
            userAddress: String(user.address || ""),
            vaultName: String(vault.name || "Unknown Vault"),
            vaultAddress: String(vault.address || ""),
            chainId: Number(chain.id || 1),
            chainNetwork: String(chain.network || "ethereum"),
            depositedUsd: Number(state.assetsUsd || 0),
            depositedAssets: String(state.assets || "0"),
            assetSymbol: String(asset.symbol || "?"),
            assetDecimals: Number(asset.decimals || 18),
            entityName: String(user.tag || "") || null,
            entityId: null,
            intelLoading: true,
          };
        }
      );

      setVaultWhales(entries);
      setVaultWhalesLoading(false);

      // Enrich with Arkham labels asynchronously
      // Deduplicate addresses to avoid redundant lookups
      const uniqueAddresses = [...new Set(entries.map((e) => e.userAddress))];

      for (const addr of uniqueAddresses) {
        try {
          const addrData = await intelGet(`/intelligence/address/${addr}`);
          const entity = addrData?.intelEntity || null;
          const label = addrData?.intelLabel || null;
          const entityName = entity?.name || label?.name || null;
          const entityId = entity?.id || entity?.slug || null;

          setVaultWhales((prev) =>
            prev.map((w) =>
              w.userAddress.toLowerCase() === addr.toLowerCase()
                ? { ...w, entityName: entityName || w.entityName, entityId, intelLoading: false }
                : w
            )
          );
        } catch {
          setVaultWhales((prev) =>
            prev.map((w) =>
              w.userAddress.toLowerCase() === addr.toLowerCase()
                ? { ...w, intelLoading: false }
                : w
            )
          );
        }
      }
    } catch (err) {
      setVaultWhalesError(String(err));
      setVaultWhalesLoading(false);
    }
  }, []);

  // ---- Address Lookup ----
  const doLookup = async () => {
    const addr = lookupAddress.trim();
    if (!addr) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const [entityRes, portfolioRes, transfersRes] = await Promise.allSettled([
        intelGet(`/intelligence/address/${addr}`),
        intelGet(`/portfolio/v2/${addr}`),
        intelGet("/transfers", { base: addr, limit: "10", usdGte: "100" }),
      ]);

      // Parse entity
      let entity: LookupResult["entity"] = null;
      if (entityRes.status === "fulfilled" && entityRes.value) {
        const d = entityRes.value;
        const e = d.intelEntity || d;
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
            from: typeof fromAddr === "object" ? fromAddr.intelEntity?.name || formatAddress(fromAddr.address || "") : formatAddress(String(fromAddr)),
            to: typeof toAddr === "object" ? toAddr.intelEntity?.name || formatAddress(toAddr.address || "") : formatAddress(String(toAddr)),
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
    if (activeTab === "tokenWhales") loadTokenWhales();
    if (activeTab === "vaultWhales") loadVaultWhales();
  }, [activeTab, loadCurators, loadTokenWhales, loadVaultWhales]);

  // Load whale watchlist count
  useEffect(() => {
    fetch("/api/whales")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.whales) setWhaleCount(data.whales.length);
      })
      .catch(() => {}); // Silently fail if not available yet
  }, []);

  // ============================================================
  // Render
  // ============================================================

  const TABS: { key: PageTab; label: string; icon: string }[] = [
    { key: "curators", label: "Curator Tracker", icon: "🏛" },
    { key: "tokenWhales", label: "Token Whales", icon: "🐋" },
    { key: "vaultWhales", label: "Vault Whales", icon: "🏦" },
    { key: "lookup", label: "Address Lookup", icon: "🔍" },
  ];

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">🔍 Intel Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Morpho curator & whale tracking — on-chain intelligence via Arkham + Morpho API
          </p>
        </div>
        {whaleCount !== null && whaleCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-400">
            <span>👁</span>
            <span>Watching <span className="text-emerald-400 font-medium">{whaleCount}</span> whales</span>
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 mb-8 bg-gray-900 rounded-lg p-1 w-fit flex-wrap">
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
      {/* Tab 1: Curator Tracker */}
      {/* ============================================================ */}
      {activeTab === "curators" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              Morpho Vault Curators
            </h2>
            <p className="text-xs text-gray-500">
              Curators from Morpho API — addresses enriched with Intel Hubligence labels
            </p>
          </div>

          {curatorsLoading && (
            <div className="text-center py-8 text-gray-500">
              <div className="inline-block animate-pulse">Loading curators from Morpho...</div>
            </div>
          )}

          {curatorsError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm mb-4">
              ⚠️ {curatorsError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {curators.map((curator) => (
              <CuratorCard key={curator.id} curator={curator} />
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 2: Token Whales */}
      {/* ============================================================ */}
      {activeTab === "tokenWhales" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              🐋 MORPHO Token Whales
            </h2>
            <p className="text-xs text-gray-500">
              Top MORPHO token holders on Ethereum (contract: {formatAddress(MORPHO_TOKEN)})
            </p>
          </div>

          <TokenWhaleTable
            whales={tokenWhales}
            loading={tokenWhalesLoading}
            error={tokenWhalesError}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 3: Vault Whales */}
      {/* ============================================================ */}
      {activeTab === "vaultWhales" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              🏦 Morpho Vault Whales
            </h2>
            <p className="text-xs text-gray-500">
              Largest depositors across Morpho vaults (Ethereum + Base) — enriched with Arkham labels
            </p>
          </div>

          <VaultWhaleTable
            whales={vaultWhales}
            loading={vaultWhalesLoading}
            error={vaultWhalesError}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 4: Address Lookup */}
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
                        <a href={lookupResult.entity.twitter}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:underline">
                          𝕏 Twitter
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
