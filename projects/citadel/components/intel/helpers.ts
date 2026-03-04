import { PROXY_BASE, MORPHO_GQL } from "./constants";
import { formatAddress } from "@/lib/format";

export async function intelGet(path: string, params?: Record<string, string>) {
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

export async function morphoQuery(query: string, variables?: Record<string, unknown>) {
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

export function getEtherscanUrl(address: string, chainId: number = 1): string {
  switch (chainId) {
    case 8453: return `https://basescan.org/address/${address}`;
    case 10: return `https://optimistic.etherscan.io/address/${address}`;
    case 42161: return `https://arbiscan.io/address/${address}`;
    case 137: return `https://polygonscan.com/address/${address}`;
    default: return `https://etherscan.io/address/${address}`;
  }
}

export function timeAgo(dateStr: string): string {
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

// Re-export formatAddress for convenience
export { formatAddress };
