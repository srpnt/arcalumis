"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import CuratorCard from "@/components/intel/CuratorCard";
import VaultConcentrationTable from "@/components/intel/VaultConcentrationTable";
import type { CuratorData, CuratorVault, VaultConcentrationEntry } from "@/components/intel/types";
import { morphoQuery } from "@/components/intel/helpers";

export default function IntelPage() {
  // Curator state
  const [curators, setCurators] = useState<CuratorData[]>([]);
  const [curatorsLoading, setCuratorsLoading] = useState(false);
  const [curatorsError, setCuratorsError] = useState<string | null>(null);
  const curatorsLoaded = useRef(false);

  // Vault concentration state
  const [vaultConcentration, setVaultConcentration] = useState<VaultConcentrationEntry[]>([]);
  const [vaultConcentrationLoading, setVaultConcentrationLoading] = useState(false);
  const [vaultConcentrationError, setVaultConcentrationError] = useState<string | null>(null);
  const vaultConcentrationLoaded = useRef(false);

  const loadCurators = useCallback(async () => {
    if (curatorsLoaded.current) return;
    curatorsLoaded.current = true;
    setCuratorsLoading(true);
    setCuratorsError(null);

    try {
      const curatorsData = await morphoQuery(`{
        curators(first: 50) {
          items {
            id name image verified
            addresses { address chainId }
            state { aum }
          }
        }
      }`);

      const vaultsData = await morphoQuery(`{
        vaults(
          first: 200
          where: { listed: true, chainId_in: [1, 8453] }
          orderBy: TotalAssetsUsd
          orderDirection: Desc
        ) {
          items {
            name address
            chain { id }
            asset { symbol }
            state { totalAssetsUsd netApy curator }
          }
        }
      }`);

      const curatorItems = curatorsData?.curators?.items || [];
      const vaultItems = vaultsData?.vaults?.items || [];

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
        if (netApy > 1.0) continue;

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
        if (!curatorVaultsMap[curatorAddr].find(
          (x) => x.address.toLowerCase() === vault.address.toLowerCase() && x.chainId === vault.chainId
        )) {
          curatorVaultsMap[curatorAddr].push(vault);
        }
      }

      const curatorsArray: CuratorData[] = (curatorItems as RawCurator[])
        .map((c) => {
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
        .filter((c) => c.vaults.length > 0 || c.aum > 0)
        .sort((a, b) => b.aum - a.aum);

      setCurators(curatorsArray);
    } catch (err) {
      setCuratorsError(String(err));
    } finally {
      setCuratorsLoading(false);
    }
  }, []);

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
                name address
                chain { id }
                asset { symbol }
                state { totalAssetsUsd }
              }
            }
          }
        }
      `);

      const items = data?.vaultPositions?.items || [];

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
        .sort((a: VaultConcentrationEntry, b: VaultConcentrationEntry) => b.percentOfVault - a.percentOfVault)
        .filter((e: VaultConcentrationEntry) => e.percentOfVault > 10)
        .map((e: VaultConcentrationEntry, i: number) => ({ ...e, rank: i + 1 }));

      setVaultConcentration(entries);
    } catch (err) {
      setVaultConcentrationError(String(err));
    } finally {
      setVaultConcentrationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurators();
    loadVaultConcentration();
  }, [loadCurators, loadVaultConcentration]);

  return (
    <div className="pt-8 md:pt-0">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">🔍 Intel Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Morpho ecosystem intelligence — curator tracking and concentration risk
          </p>
        </div>
      </div>

      {/* Curator Tracker */}
      <section className="mb-10">
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
      </section>

      {/* Vault Concentration */}
      <section>
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
      </section>
    </div>
  );
}
