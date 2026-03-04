"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { Signal, MorphoVault } from "@/lib/types";

// ============================================================
// Types
// ============================================================

interface MarketState {
  utilization: number | null;
  borrowAssetsUsd: number | null;
  supplyAssetsUsd: number | null;
}

interface AllocationItem {
  market: {
    uniqueKey: string;
    loanAsset: { symbol: string };
    collateralAsset: { symbol: string };
    state: MarketState;
  };
  supplyAssetsUsd: number;
}

interface RawVaultItem {
  address: string;
  name: string;
  symbol: string;
  chain: { id: number; network: string };
  asset: { symbol: string; priceUsd: number };
  state: {
    totalAssetsUsd: number;
    fee: number;
    apy: number;
    netApy: number;
    allocation: AllocationItem[];
  };
  metadata: { description: string };
}

interface VaultWithUtilization extends MorphoVault {
  avgUtilization: number;
  highUtilMarkets: Array<{
    collateral: string;
    loan: string;
    utilization: number;
    chainId: number;
  }>;
}

export interface MorphoDashData {
  vaults: VaultWithUtilization[];
  totalTvl: number;
  avgUtilization: number;
  bestYield: number;
  bestVaultName: string;
  bestVaultAddress: string;
  bestVaultChainId: number;
  topVaults: Array<{
    name: string;
    netApy: number;
    chain: string;
    chainId: number;
    asset: string;
    address: string;
  }>;
  highUtilVaults: Array<{
    name: string;
    chain: string;
    chainId: number;
    avgUtilization: number;
    netApy: number;
    address: string;
  }>;
}

export interface GasData {
  safeGwei: number;
  proposeGwei: number;
  fastGwei: number;
}

export interface StablecoinData {
  usdc: number;
  usdt: number;
  usde: number;
}

// ============================================================
// Constants & Helpers
// ============================================================

import { CHAIN_NAMES, ALL_MORPHO_CHAIN_IDS } from "@/lib/chains";
import { VAULTS_QUERY } from "@/lib/morpho-api";

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json());

function sf(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ============================================================
// Fetchers
// ============================================================

async function morphoFetcher(): Promise<MorphoDashData> {
  const res = await fetch("/api/morpho", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: VAULTS_QUERY, variables: { first: 200, chains: [...ALL_MORPHO_CHAIN_IDS] } }),
  });
  const json = await res.json();
  const items: RawVaultItem[] = json.data?.vaults?.items || [];

  const vaults: VaultWithUtilization[] = [];
  let totalTvl = 0;
  let bestYield = 0;
  let bestVaultName = "";
  let bestVaultAddress = "";
  let bestVaultChainId = 1;
  let weightedUtilSum = 0;
  let weightedUtilDenom = 0;

  for (const v of items) {
    const state = v.state || ({} as RawVaultItem["state"]);
    const chainId = v.chain?.id ?? 1;
    const apy = Number(state.apy) || 0;
    const netApy = Number(state.netApy) || 0;
    const tvl = Number(state.totalAssetsUsd) || 0;

    if (apy > 1.0 || netApy > 1.0) continue;

    totalTvl += tvl;

    if (netApy > bestYield) {
      bestYield = netApy;
      bestVaultName = v.name || "";
      bestVaultAddress = v.address || "";
      bestVaultChainId = chainId;
    }

    const alloc = state.allocation || [];
    let vaultUtilSum = 0;
    let vaultUtilWeight = 0;
    const highUtilMarkets: VaultWithUtilization["highUtilMarkets"] = [];

    for (const a of alloc) {
      const mState = a.market?.state;
      const util = sf(mState?.utilization);
      const allocUsd = sf(a.supplyAssetsUsd);
      if (allocUsd > 0 && util > 0) {
        vaultUtilSum += util * allocUsd;
        vaultUtilWeight += allocUsd;
      }
      if (util > 0.9) {
        highUtilMarkets.push({
          collateral: a.market?.collateralAsset?.symbol || "?",
          loan: a.market?.loanAsset?.symbol || "?",
          utilization: util,
          chainId,
        });
      }
    }

    const avgUtil = vaultUtilWeight > 0 ? vaultUtilSum / vaultUtilWeight : 0;
    weightedUtilSum += avgUtil * tvl;
    weightedUtilDenom += tvl;

    vaults.push({
      address: v.address,
      name: v.name,
      symbol: v.symbol,
      chainId,
      chain: CHAIN_NAMES[chainId] || String(chainId),
      underlyingAsset: v.asset?.symbol || "?",
      totalAssetsUsd: tvl,
      apy,
      netApy,
      fee: Number(state.fee) || 0,
      description: (v.metadata?.description || "").slice(0, 200),
      numMarkets: alloc.length,
      avgUtilization: avgUtil,
      highUtilMarkets,
    });
  }

  const avgUtilization = weightedUtilDenom > 0 ? weightedUtilSum / weightedUtilDenom : 0;

  const topVaults = [...vaults]
    .sort((a, b) => b.netApy - a.netApy)
    .slice(0, 3)
    .map((v) => ({
      name: v.name,
      netApy: v.netApy,
      chain: v.chain,
      chainId: v.chainId,
      asset: v.underlyingAsset,
      address: v.address,
    }));

  const highUtilVaults = [...vaults]
    .filter((v) => v.avgUtilization > 0.9)
    .sort((a, b) => b.avgUtilization - a.avgUtilization)
    .slice(0, 10)
    .map((v) => ({
      name: v.name,
      chain: v.chain,
      chainId: v.chainId,
      avgUtilization: v.avgUtilization,
      netApy: v.netApy,
      address: v.address,
    }));

  return {
    vaults,
    totalTvl,
    avgUtilization,
    bestYield,
    bestVaultName,
    bestVaultAddress,
    bestVaultChainId,
    topVaults,
    highUtilVaults,
  };
}

async function fetchGas(): Promise<GasData> {
  const res = await fetch(
    "https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle"
  );
  const json = await res.json();
  const r = json.result || {};
  return {
    safeGwei: parseFloat(r.SafeGasPrice) || 0,
    proposeGwei: parseFloat(r.ProposeGasPrice) || 0,
    fastGwei: parseFloat(r.FastGasPrice) || 0,
  };
}

async function fetchStablecoins(): Promise<StablecoinData> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,ethena-usde&vs_currencies=usd"
  );
  const json = await res.json();
  return {
    usdc: json["usd-coin"]?.usd ?? 0,
    usdt: json["tether"]?.usd ?? 0,
    usde: json["ethena-usde"]?.usd ?? 0,
  };
}

// ============================================================
// Hook
// ============================================================

export function useDashboardData() {
  const { data: morphoData, isLoading: morphoLoading } = useSWR(
    "morpho-dash",
    morphoFetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false }
  );

  const { data: signalsData, isLoading: signalsLoading } = useSWR<{
    signals: Signal[];
  }>("/api/signals", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const { data: exposureData } = useSWR<{
    tier4ExposureUsd: number;
    totalExposureUsd: number;
    totalAssetsTracked: number;
    assets: Array<{ symbol: string; tier: number; totalExposureUsd: number }>;
  }>("/api/exposure", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const { data: whalesData } = useSWR<{
    whales: Array<{
      address: string;
      label: string;
      notes: string;
      lastBalance: number;
      source: string;
    }>;
  }>("/api/whales", jsonFetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const [gasData, setGasData] = useState<GasData | null>(null);
  useEffect(() => {
    fetchGas().then(setGasData).catch(() => {});
    const iv = setInterval(() => {
      fetchGas().then(setGasData).catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  const [stableData, setStableData] = useState<StablecoinData | null>(null);
  useEffect(() => {
    fetchStablecoins().then(setStableData).catch(() => {});
    const iv = setInterval(() => {
      fetchStablecoins().then(setStableData).catch(() => {});
    }, 120_000);
    return () => clearInterval(iv);
  }, []);

  return {
    morphoData,
    morphoLoading,
    signalsData,
    signalsLoading,
    exposureData,
    whalesData,
    gasData,
    stableData,
    loading: morphoLoading || signalsLoading,
  };
}
