// ============================================================
// Arkham Intelligence API Client (client-side, goes through proxy)
// ============================================================

import { ArkhamEntity, ArkhamBalance, ArkhamTransfer } from "./types";

const PROXY_BASE = "/api/intel";

async function arkhamGet(path: string, params?: Record<string, string>) {
  let url = `${PROXY_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url = `${url}?${qs}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Arkham API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function lookupEntity(address: string): Promise<ArkhamEntity | null> {
  try {
    const data = await arkhamGet(`/intelligence/address/${address}`);
    if (!data || typeof data !== "object") return null;

    const entity = data.arkhamEntity || data;

    return {
      name: entity.name || entity.label || "Unknown Entity",
      type: entity.type || entity.entityType || "—",
      labels: Array.isArray(entity.tags)
        ? entity.tags
        : Array.isArray(entity.labels)
        ? entity.labels
        : typeof entity.tags === "string"
        ? [entity.tags]
        : [],
      website: entity.website || undefined,
      twitter: entity.twitter || undefined,
      address,
    };
  } catch {
    return null;
  }
}

export async function getPortfolio(address: string): Promise<{
  totalUsd: number;
  balances: ArkhamBalance[];
}> {
  const data = await arkhamGet(`/portfolio/v2/${address}`);
  const balances: ArkhamBalance[] = [];
  let totalUsd = 0;

  if (data && typeof data === "object") {
    const chains = data.chains || {};

    for (const [chainName, chainData] of Object.entries(chains)) {
      if (typeof chainData !== "object" || chainData === null) continue;

      for (const [, tokenInfo] of Object.entries(chainData as Record<string, unknown>)) {
        if (typeof tokenInfo !== "object" || tokenInfo === null) continue;
        const t = tokenInfo as Record<string, unknown>;
        const tokenObj = t.token as Record<string, unknown> | undefined;

        const symbol =
          (t.symbol as string) || (tokenObj?.symbol as string) || "?";
        const usdVal = Number(t.usdValue || t.valueUsd || 0) || 0;
        const balance = Number(t.balance || t.amount || 0) || 0;
        const price = Number(t.price || t.priceUsd || 0) || 0;

        if (usdVal > 0.01 || balance > 0) {
          totalUsd += usdVal;
          balances.push({
            chain: chainName.charAt(0).toUpperCase() + chainName.slice(1),
            token: symbol,
            balance,
            priceUsd: price,
            valueUsd: usdVal,
          });
        }
      }
    }
  }

  balances.sort((a, b) => b.valueUsd - a.valueUsd);
  return { totalUsd, balances };
}

export async function getTransfers(
  address: string,
  limit = 20
): Promise<ArkhamTransfer[]> {
  const data = await arkhamGet("/transfers", {
    base: address,
    limit: String(limit),
    usdGte: "100",
  });

  const transfers: ArkhamTransfer[] = [];
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.transfers)
    ? data.transfers
    : [];

  for (const tx of items) {
    if (typeof tx !== "object" || !tx) continue;

    const fromAddr = tx.fromAddress || {};
    const toAddr = tx.toAddress || {};

    const fromLabel =
      typeof fromAddr === "object"
        ? fromAddr.arkhamEntity?.name ||
          (fromAddr.address || "?").slice(0, 12) + "..."
        : String(fromAddr).slice(0, 12) + "...";

    const toLabel =
      typeof toAddr === "object"
        ? toAddr.arkhamEntity?.name ||
          (toAddr.address || "?").slice(0, 12) + "..."
        : String(toAddr).slice(0, 12) + "...";

    const tokenInfo = tx.tokenInfo || tx.token || {};
    const tokenSymbol =
      typeof tokenInfo === "object" ? tokenInfo.symbol || "?" : "?";

    const usdVal =
      Number(tx.unitValue || tx.historicalUSD || tx.valueUsd || 0) || 0;
    const ts = tx.blockTimestamp || tx.timestamp || "";
    const txHash = tx.transactionHash || "";

    transfers.push({
      time: ts ? ts.slice(0, 19).replace("T", " ") : "—",
      from: fromLabel,
      to: toLabel,
      token: tokenSymbol,
      valueUsd: usdVal,
      txHash,
    });
  }

  return transfers;
}
