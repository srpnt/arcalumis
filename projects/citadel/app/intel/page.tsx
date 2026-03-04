"use client";

import { useState } from "react";
import type { PageTab } from "@/components/intel/types";
import { useIntelData } from "@/components/intel/useIntelData";
import CuratorCard from "@/components/intel/CuratorCard";
import TokenActivityFeed from "@/components/intel/TokenActivityFeed";
import VaultConcentrationTable from "@/components/intel/VaultConcentrationTable";

const TABS: { key: PageTab; label: string; icon: string }[] = [
  { key: "curators", label: "Curator Tracker", icon: "🏛" },
  { key: "tokenActivity", label: "Token Activity", icon: "📡" },
  { key: "vaultConcentration", label: "Vault Concentration", icon: "🏦" },
];

export default function IntelPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("curators");
  const {
    curators,
    curatorsLoading,
    curatorsError,
    tokenTransfers,
    tokenTransfersLoading,
    tokenTransfersError,
    vaultConcentration,
    vaultConcentrationLoading,
    vaultConcentrationError,
  } = useIntelData(activeTab);

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

      {/* Tab 1: Curator Tracker */}
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

      {/* Tab 2: Token Activity */}
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

      {/* Tab 3: Vault Concentration */}
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
