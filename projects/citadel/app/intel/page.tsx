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
  image: string | null;
  verified: boolean;
  addresses: { chainId: number; address: string }[];
  aum: number;
  vaults: CuratorVault[];
  vaultsLoading: boolean;
}

interface TokenTransfer {
  time: string;
  from: string;
  fromAddress: string;
  to: string;
  toAddress: string;
  amount: number;
  valueUsd: number;
  txHash: string;
  isLarge: boolean;
}

interface VaultConcentrationEntry {
  rank: number;
  userAddress: string;
  vaultName: string;
  vaultAddress: string;
  chainId: number;
  depositedUsd: number;
  depositedAssets: string;
  assetSymbol: string;
  percentOfVault: number;
  totalVaultUsd: number;
  isLikelyContract: boolean;
  riskLevel: "critical" | "high" | "moderate";
  riskEmoji: string;
}

// ============================================================
// Constants
// ============================================================

const MORPHO_TOKEN = "0x58D97B57BB95320F9a05dC918Aef65434969c2B2";
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
    throw new Error(`Intel API ${res.status}: ${text.slice(0, 200)}`);
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

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ============================================================
// Component: Curator Vault Row
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

// ============================================================
// Component: Curator Card
// ============================================================

function CuratorCard({ curator }: { curator: CuratorData }) {
  const [vaultsOpen, setVaultsOpen] = useState(false);

  const ethAddresses = curator.addresses
    .filter((a) => a.chainId === 1 || a.chainId === 8453)
    .reduce((acc, a) => {
      if (!acc.find((x) => x.address.toLowerCase() === a.address.toLowerCase())) acc.push(a);
      return acc;
    }, [] as { chainId: number; address: string }[]);

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
          </div>
        </div>
      </div>

      {/* AUM */}
      {curator.aum > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">AUM (Morpho Vaults)</p>
          <p className="text-lg font-bold text-gray-100">{formatUsd(curator.aum)}</p>
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
    </div>
  );
}

// ============================================================
// Component: Token Activity Feed
// ============================================================

function TokenActivityFeed({ transfers, loading, error }: {
  transfers: TokenTransfer[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="inline-block animate-pulse">Loading MORPHO token activity...</div>
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

  if (transfers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">No recent MORPHO transfer activity found.</p>
      </div>
    );
  }

  const largeCount = transfers.filter(t => t.isLarge).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-6">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Recent Transfers</p>
          <p className="text-lg font-bold text-gray-100">{transfers.length}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Large Movements (&gt;100K)</p>
          <p className="text-lg font-bold text-amber-400">{largeCount}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Total Volume</p>
          <p className="text-lg font-bold text-gray-100">
            {formatUsd(transfers.reduce((sum, t) => sum + t.valueUsd, 0))}
          </p>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recent MORPHO Token Transfers
          </h3>
        </div>
        <div className="divide-y divide-gray-800/50">
          {transfers.map((t, i) => (
            <div
              key={i}
              className={`px-4 py-3 hover:bg-gray-800/30 ${t.isLarge ? "border-l-2 border-amber-500" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    {t.isLarge && <span title="Large movement (&gt;100K MORPHO)">🐋</span>}
                    <a
                      href={`https://etherscan.io/address/${t.fromAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-gray-300 hover:text-emerald-400 transition-colors text-xs"
                    >
                      {t.from}
                    </a>
                    <span className="text-gray-600">→</span>
                    <a
                      href={`https://etherscan.io/address/${t.toAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-gray-300 hover:text-emerald-400 transition-colors text-xs"
                    >
                      {t.to}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-mono font-medium ${t.isLarge ? "text-amber-400" : "text-gray-200"}`}>
                      {t.amount >= 1000 ? `${(t.amount / 1000).toFixed(1)}K` : t.amount.toFixed(0)} MORPHO
                    </span>
                    {t.valueUsd > 0 && (
                      <span className="text-[10px] text-gray-500">({formatUsd(t.valueUsd)})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-gray-600">{t.time}</span>
                  {t.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${t.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-600 hover:text-emerald-400 font-mono"
                    >
                      tx →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Component: Vault Concentration Table
// ============================================================

function VaultConcentrationTable({ entries, loading, error }: {
  entries: VaultConcentrationEntry[];
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

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-sm">No vault concentration data available.</p>
      </div>
    );
  }

  // Summary metrics
  const criticalVaults = new Set(
    entries.filter((e) => e.percentOfVault > 50).map((e) => `${e.vaultAddress}-${e.chainId}`)
  ).size;
  const uniqueVaults = new Set(entries.map((e) => `${e.vaultAddress}-${e.chainId}`)).size;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Vaults Analyzed</p>
          <p className="text-lg font-bold text-gray-100">{uniqueVaults}</p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">&gt;50% Single-Depositor</p>
          <p className={`text-lg font-bold ${criticalVaults > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {criticalVaults} vault{criticalVaults !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="h-8 w-px bg-gray-800" />
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wide">Positions Tracked</p>
          <p className="text-lg font-bold text-gray-100">{entries.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vault</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deposited</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Vault</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Concentration Risk</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const chainColor = CHAIN_COLORS[e.chainId] || "bg-gray-800 text-gray-400 border-gray-700";
                return (
                  <tr key={`${e.userAddress}-${e.vaultAddress}-${e.chainId}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-3 text-gray-500 text-xs">{e.rank}</td>
                    <td className="px-3 py-3">
                      <div>
                        {e.isLikelyContract && (
                          <span className="text-[10px] text-gray-500 block" title="Likely contract/bridge">🤖 contract</span>
                        )}
                        <a
                          href={getEtherscanUrl(e.userAddress, e.chainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          {formatAddress(e.userAddress)}
                        </a>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://app.morpho.org/vault?vault=${e.vaultAddress}&network=${e.chainId === 8453 ? "base" : "mainnet"}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-300 hover:text-emerald-400 transition-colors"
                        >
                          {e.vaultName}
                        </a>
                        <span className={`px-1.5 py-0.5 text-[9px] rounded border ${chainColor}`}>
                          {CHAIN_NAMES[e.chainId]?.slice(0, 3) || "?"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-200 text-xs">
                      {formatUsd(e.depositedUsd)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <span className={`font-mono font-medium ${
                        e.percentOfVault >= 50 ? "text-red-400" :
                        e.percentOfVault >= 25 ? "text-amber-400" :
                        "text-gray-300"
                      }`}>
                        {e.percentOfVault.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        e.riskLevel === "critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        e.riskLevel === "high" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {e.riskEmoji} {e.riskLevel === "critical" ? "Critical" : e.riskLevel === "high" ? "High" : "Moderate"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

type PageTab = "curators" | "tokenActivity" | "vaultConcentration";

export default function IntelPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("curators");

  // Curator state
  const [curators, setCurators] = useState<CuratorData[]>([]);
  const [curatorsLoading, setCuratorsLoading] = useState(false);
  const [curatorsError, setCuratorsError] = useState<string | null>(null);
  const curatorsLoaded = useRef(false);

  // Token activity state
  const [tokenTransfers, setTokenTransfers] = useState<TokenTransfer[]>([]);
  const [tokenTransfersLoading, setTokenTransfersLoading] = useState(false);
  const [tokenTransfersError, setTokenTransfersError] = useState<string | null>(null);
  const tokenTransfersLoaded = useRef(false);

  // Vault concentration state
  const [vaultConcentration, setVaultConcentration] = useState<VaultConcentrationEntry[]>([]);
  const [vaultConcentrationLoading, setVaultConcentrationLoading] = useState(false);
  const [vaultConcentrationError, setVaultConcentrationError] = useState<string | null>(null);
  const vaultConcentrationLoaded = useRef(false);

  // ---- Load curators: two-step (curators endpoint + vaults endpoint, then match) ----
  const loadCurators = useCallback(async () => {
    if (curatorsLoaded.current) return;
    curatorsLoaded.current = true;
    setCuratorsLoading(true);
    setCuratorsError(null);

    try {
      // Step 1: Fetch curators from the curators endpoint
      const curatorsData = await morphoQuery(`{
        curators(first: 50) {
          items {
            id
            name
            image
            verified
            addresses { address chainId }
            state { aum }
          }
        }
      }`);

      // Step 2: Fetch all listed vaults with state.curator
      const vaultsData = await morphoQuery(`{
        vaults(
          first: 200
          where: { listed: true, chainId_in: [1, 8453] }
          orderBy: TotalAssetsUsd
          orderDirection: Desc
        ) {
          items {
            name
            address
            chain { id }
            asset { symbol }
            state { totalAssetsUsd netApy curator }
          }
        }
      }`);

      const curatorItems = curatorsData?.curators?.items || [];
      const vaultItems = vaultsData?.vaults?.items || [];

      // Step 3: Match vaults to curators
      // Build a map of curator address -> curator data
      interface RawCurator {
        id: string;
        name: string;
        image: string | null;
        verified: boolean;
        addresses: { address: string; chainId: number }[];
        state: { aum: number } | null;
      }

      const curatorAddressMap: Record<string, RawCurator> = {};
      for (const c of curatorItems as RawCurator[]) {
        for (const addr of c.addresses || []) {
          curatorAddressMap[addr.address.toLowerCase()] = c;
        }
      }

      // Group vaults by curator
      interface RawVault {
        name: string;
        address: string;
        chain: { id: number };
        asset: { symbol: string };
        state: { totalAssetsUsd: number; netApy: number; curator: string };
      }

      const curatorVaultsMap: Record<string, CuratorVault[]> = {};

      for (const v of vaultItems as RawVault[]) {
        const curatorAddr = (v.state?.curator || "").toLowerCase();
        if (!curatorAddr || curatorAddr === "0x0000000000000000000000000000000000000000") continue;

        const netApy = Number(v.state?.netApy || 0);
        if (netApy > 1.0) continue; // Skip unreasonable APYs

        const chainId = Number(v.chain?.id || 1);
        const vault: CuratorVault = {
          address: v.address,
          name: v.name || "Unnamed Vault",
          chainId,
          chainNetwork: chainId === 8453 ? "base" : "mainnet",
          assetSymbol: String(v.asset?.symbol || "?"),
          totalAssetsUsd: Number(v.state?.totalAssetsUsd || 0),
          netApy,
        };

        if (!curatorVaultsMap[curatorAddr]) {
          curatorVaultsMap[curatorAddr] = [];
        }
        // Avoid duplicate vaults
        if (!curatorVaultsMap[curatorAddr].find(
          (x) => x.address.toLowerCase() === vault.address.toLowerCase() && x.chainId === vault.chainId
        )) {
          curatorVaultsMap[curatorAddr].push(vault);
        }
      }

      // Step 4: Build CuratorData array
      const curatorsArray: CuratorData[] = (curatorItems as RawCurator[])
        .map((c) => {
          // Find all vaults for this curator by checking all their addresses
          const matchedVaults: CuratorVault[] = [];
          for (const addr of c.addresses || []) {
            const vaults = curatorVaultsMap[addr.address.toLowerCase()] || [];
            for (const v of vaults) {
              if (!matchedVaults.find(
                (x) => x.address.toLowerCase() === v.address.toLowerCase() && x.chainId === v.chainId
              )) {
                matchedVaults.push(v);
              }
            }
          }

          const totalVaultTvl = matchedVaults.reduce((sum, v) => sum + v.totalAssetsUsd, 0);
          const aum = Number(c.state?.aum || 0);

          return {
            id: c.id,
            name: c.name || "Unknown",
            image: c.image || null,
            verified: c.verified || false,
            addresses: c.addresses || [],
            aum: aum > 0 ? aum : totalVaultTvl,
            vaults: matchedVaults.sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd),
            vaultsLoading: false,
          };
        })
        .filter((c) => c.vaults.length > 0 || c.aum > 0) // Show curators with vaults or AUM
        .sort((a, b) => b.aum - a.aum);

      setCurators(curatorsArray);
    } catch (err) {
      setCuratorsError(String(err));
    } finally {
      setCuratorsLoading(false);
    }
  }, []);

  // ---- Load MORPHO token transfer activity ----
  const loadTokenTransfers = useCallback(async () => {
    if (tokenTransfersLoaded.current) return;
    tokenTransfersLoaded.current = true;
    setTokenTransfersLoading(true);
    setTokenTransfersError(null);

    try {
      const data = await intelGet("/transfers", {
        base: MORPHO_TOKEN,
        limit: "20",
      });

      const transfers: TokenTransfer[] = [];
      const items = Array.isArray(data) ? data : data?.transfers || [];

      for (const tx of items) {
        if (typeof tx !== "object" || !tx) continue;

        const fromAddr = tx.fromAddress || {};
        const toAddr = tx.toAddress || {};
        const fromName = typeof fromAddr === "object"
          ? (fromAddr.intelEntity?.name || fromAddr.intelLabel?.name || formatAddress(fromAddr.address || ""))
          : formatAddress(String(fromAddr));
        const toName = typeof toAddr === "object"
          ? (toAddr.intelEntity?.name || toAddr.intelLabel?.name || formatAddress(toAddr.address || ""))
          : formatAddress(String(toAddr));
        const fromAddress = typeof fromAddr === "object" ? (fromAddr.address || "") : String(fromAddr);
        const toAddress = typeof toAddr === "object" ? (toAddr.address || "") : String(toAddr);

        const tokenInfo = tx.tokenInfo || tx.token || {};
        const decimals = Number(tokenInfo.decimals || 18);
        const rawAmount = Number(tx.unitValue || tx.value || 0);
        // If unitValue is already decimal, use it. Otherwise divide by 10^decimals
        const amount = rawAmount > 1e15 ? rawAmount / Math.pow(10, decimals) : rawAmount;
        const valueUsd = Number(tx.historicalUSD || tx.unitValueUsd || 0);

        transfers.push({
          time: timeAgo(tx.blockTimestamp || tx.timestamp || ""),
          from: fromName,
          fromAddress,
          to: toName,
          toAddress,
          amount,
          valueUsd,
          txHash: tx.transactionHash || "",
          isLarge: amount > 100_000,
        });
      }

      setTokenTransfers(transfers);
    } catch (err) {
      setTokenTransfersError(String(err));
    } finally {
      setTokenTransfersLoading(false);
    }
  }, []);

  // ---- Load vault concentration data ----
  const loadVaultConcentration = useCallback(async () => {
    if (vaultConcentrationLoaded.current) return;
    vaultConcentrationLoaded.current = true;
    setVaultConcentrationLoading(true);
    setVaultConcentrationError(null);

    try {
      const data = await morphoQuery(`
        query TopVaultDepositors {
          vaultPositions(
            first: 50
            orderBy: Shares
            orderDirection: Desc
            where: { chainId_in: [1, 8453], vaultListed: true }
          ) {
            items {
              user { address }
              state { assetsUsd assets shares }
              vault {
                name
                address
                chain { id }
                asset { symbol }
                state { totalAssetsUsd }
              }
            }
          }
        }
      `);

      const items = data?.vaultPositions?.items || [];

      // Build entries
      const rawEntries = items.map(
        (item: Record<string, unknown>, i: number) => {
          const state = item.state as Record<string, unknown> || {};
          const user = item.user as Record<string, unknown> || {};
          const vault = item.vault as Record<string, unknown> || {};
          const chain = vault.chain as Record<string, unknown> || {};
          const asset = vault.asset as Record<string, unknown> || {};
          const vaultState = vault.state as Record<string, unknown> || {};

          const depositedUsd = Number(state.assetsUsd || 0);
          const totalVaultUsd = Number(vaultState.totalAssetsUsd || 0);
          const percentOfVault = totalVaultUsd > 0 ? (depositedUsd / totalVaultUsd) * 100 : 0;

          let riskLevel: "critical" | "high" | "moderate" = "moderate";
          let riskEmoji = "🟢";
          if (percentOfVault > 50) { riskLevel = "critical"; riskEmoji = "🔴"; }
          else if (percentOfVault > 25) { riskLevel = "high"; riskEmoji = "🟡"; }

          return {
            rank: i + 1,
            userAddress: String(user.address || ""),
            vaultName: String(vault.name || "Unknown Vault"),
            vaultAddress: String(vault.address || ""),
            chainId: Number(chain.id || 1),
            depositedUsd,
            depositedAssets: String(state.assets || "0"),
            assetSymbol: String(asset.symbol || "?"),
            percentOfVault,
            totalVaultUsd,
            isLikelyContract: false,
            riskLevel,
            riskEmoji,
          };
        }
      );

      // Detect likely contracts: addresses appearing in 2+ vaults with 99%+ share
      const addrVaultHighShare: Record<string, number> = {};
      for (const e of rawEntries) {
        const key = e.userAddress.toLowerCase();
        if (e.percentOfVault >= 99) {
          addrVaultHighShare[key] = (addrVaultHighShare[key] || 0) + 1;
        }
      }

      const entries: VaultConcentrationEntry[] = rawEntries
        .map((e: VaultConcentrationEntry) => ({
          ...e,
          isLikelyContract: (addrVaultHighShare[e.userAddress.toLowerCase()] || 0) >= 2,
        }))
        // Sort by % of vault descending
        .sort((a: VaultConcentrationEntry, b: VaultConcentrationEntry) => b.percentOfVault - a.percentOfVault)
        // Filter to only show entries with >10% concentration
        .filter((e: VaultConcentrationEntry) => e.percentOfVault > 10)
        // Re-rank after sorting
        .map((e: VaultConcentrationEntry, i: number) => ({ ...e, rank: i + 1 }));

      setVaultConcentration(entries);
    } catch (err) {
      setVaultConcentrationError(String(err));
    } finally {
      setVaultConcentrationLoading(false);
    }
  }, []);

  // Auto-load data when tab switches
  useEffect(() => {
    if (activeTab === "curators") loadCurators();
    if (activeTab === "tokenActivity") loadTokenTransfers();
    if (activeTab === "vaultConcentration") loadVaultConcentration();
  }, [activeTab, loadCurators, loadTokenTransfers, loadVaultConcentration]);

  // ============================================================
  // Render
  // ============================================================

  const TABS: { key: PageTab; label: string; icon: string }[] = [
    { key: "curators", label: "Curator Tracker", icon: "🏛" },
    { key: "tokenActivity", label: "Token Activity", icon: "📡" },
    { key: "vaultConcentration", label: "Vault Concentration", icon: "🏦" },
  ];

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">🔍 Intel Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Morpho ecosystem intelligence — curator tracking, token flows, and concentration risk
          </p>
        </div>
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
              All curators from the Morpho protocol with their managed vaults and AUM
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

          {!curatorsLoading && !curatorsError && curators.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p className="text-sm">No curators found.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 2: Token Activity */}
      {/* ============================================================ */}
      {activeTab === "tokenActivity" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              📡 MORPHO Token Activity
            </h2>
            <p className="text-xs text-gray-500">
              Recent MORPHO token transfers — large movements (&gt;100K) highlighted
            </p>
          </div>

          <TokenActivityFeed
            transfers={tokenTransfers}
            loading={tokenTransfersLoading}
            error={tokenTransfersError}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 3: Vault Concentration */}
      {/* ============================================================ */}
      {activeTab === "vaultConcentration" && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-1">
              🏦 Vault Concentration Risk
            </h2>
            <p className="text-xs text-gray-500">
              Identifies single-depositor concentration risk across Morpho vaults
            </p>
          </div>

          <VaultConcentrationTable
            entries={vaultConcentration}
            loading={vaultConcentrationLoading}
            error={vaultConcentrationError}
          />
        </div>
      )}
    </div>
  );
}
