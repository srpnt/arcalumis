// ============================================================
// Chain Constants — Single Source of Truth
// ============================================================

/** Human-readable chain names by chain ID */
export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  130: "Unichain",
  480: "World Chain",
  57073: "Ink",
  999: "HyperEVM",
  747474: "Katana",
  143: "Monad",
  988: "Stable",
  98866: "Plume",
  25: "Cronos",
};

/** Hex color palette for charts */
export const CHAIN_COLORS: Record<number, string> = {
  1: "#8b5cf6",       // Ethereum — violet
  8453: "#3b82f6",    // Base — blue
  42161: "#f59e0b",   // Arbitrum — amber
  10: "#ef4444",      // Optimism — red
  137: "#a855f7",     // Polygon — purple
  130: "#ec4899",     // Unichain — pink
  480: "#06b6d4",     // World Chain — cyan
  57073: "#f97316",   // Ink — orange
  999: "#22d3ee",     // HyperEVM — cyan-400
  747474: "#14b8a6",  // Katana — teal
  143: "#facc15",     // Monad — yellow
  988: "#84cc16",     // Stable — lime
  98866: "#d946ef",   // Plume — fuchsia
  25: "#fb923c",      // Cronos — orange-400
};

/** Tailwind class strings for chain badges */
export const CHAIN_BADGE_COLORS: Record<number, string> = {
  1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  8453: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  10: "bg-red-500/20 text-red-400 border-red-500/30",
  42161: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  137: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

/** Morpho frontend network slugs by chain ID */
export const MORPHO_NETWORK_SLUGS: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
  130: "unichain",
  480: "worldchain",
  57073: "ink",
  999: "hyperevm",
  747474: "katana",
  143: "monad",
  25: "cronos",
  988: "stable",
  98866: "plume",
};

/** All chain IDs monitored on Morpho */
export const ALL_MORPHO_CHAIN_IDS = [1, 8453, 42161, 10, 137, 130, 480, 57073, 999, 747474, 143, 988, 98866, 25] as const;

/** Get hex color for a chain ID, defaulting to gray */
export function chainColor(chainId: number): string {
  return CHAIN_COLORS[chainId] || "#6b7280";
}

/** Build a Morpho frontend market URL */
export function getMorphoMarketUrl(uniqueKey: string, chainId: number): string | null {
  const slug = MORPHO_NETWORK_SLUGS[chainId];
  if (!slug || !uniqueKey) return null;
  return `https://app.morpho.org/market?id=${uniqueKey}&network=${slug}`;
}

/** Build a Morpho frontend vault URL */
export function getMorphoVaultUrl(address: string, chainId: number): string {
  const slug = MORPHO_NETWORK_SLUGS[chainId] || "ethereum";
  return `https://app.morpho.org/vault?vault=${address}&network=${slug}`;
}
