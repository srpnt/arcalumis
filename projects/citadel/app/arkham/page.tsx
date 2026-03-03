"use client";

import { useState } from "react";
import { lookupEntity, getPortfolio, getTransfers } from "@/lib/arkham";
import { ArkhamEntity, ArkhamBalance, ArkhamTransfer } from "@/lib/types";
import { formatUsd } from "@/lib/format";

const PRESETS: { label: string; address: string }[] = [
  {
    label: "🇺🇸 US Government",
    address: "0x0836f5ed6b62baf60b1890e0de7ee5df4ab0c0c4",
  },
  {
    label: "🏦 Coinbase",
    address: "0x503828976D22510aad0201ac7EC88293211D23Da",
  },
  {
    label: "🟡 Binance",
    address: "0x28C6c06298d514Db089934071355E5743bf21d60",
  },
  {
    label: "💎 Vitalik",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  {
    label: "🏛 ETH Foundation",
    address: "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
  },
];

type Tab = "entity" | "balances" | "transfers";

export default function ArkhamPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("entity");

  const [entity, setEntity] = useState<ArkhamEntity | null>(null);
  const [totalUsd, setTotalUsd] = useState(0);
  const [balances, setBalances] = useState<ArkhamBalance[]>([]);
  const [transfers, setTransfers] = useState<ArkhamTransfer[]>([]);
  const [searched, setSearched] = useState(false);

  const doLookup = async (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) return;

    setAddress(trimmed);
    setLoading(true);
    setError(null);
    setEntity(null);
    setBalances([]);
    setTransfers([]);
    setSearched(true);

    try {
      const [entityResult, portfolioResult, transfersResult] =
        await Promise.allSettled([
          lookupEntity(trimmed),
          getPortfolio(trimmed),
          getTransfers(trimmed),
        ]);

      if (entityResult.status === "fulfilled") {
        setEntity(entityResult.value);
      }
      if (portfolioResult.status === "fulfilled" && portfolioResult.value) {
        setTotalUsd(portfolioResult.value.totalUsd);
        setBalances(portfolioResult.value.balances);
      }
      if (transfersResult.status === "fulfilled") {
        setTransfers(transfersResult.value);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "entity", label: "📋 Entity Info" },
    { key: "balances", label: "💰 Balances" },
    { key: "transfers", label: "🔄 Transfers" },
  ];

  return (
    <div className="pt-8 md:pt-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">🔍 Arkham Intel</h1>
        <p className="text-sm text-gray-500 mt-1">
          On-chain intelligence — entity and wallet analysis
        </p>
      </div>

      {/* Quick Presets */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Quick Lookup:</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.address}
              onClick={() => doLookup(p.address)}
              className="px-3 py-2 text-xs bg-gray-900 border border-gray-800 rounded-lg hover:border-emerald-500/30 hover:bg-gray-800/50 transition-all text-gray-300"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLookup(address)}
          placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e"
          className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
        />
        <button
          onClick={() => doLookup(address)}
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "🔍 Lookup"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">
          Looking up address...
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
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
                {tab.label}
              </button>
            ))}
          </div>

          {/* Entity Tab */}
          {activeTab === "entity" && (
            <div>
              {entity ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-gray-100">
                    {entity.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {entity.type} •{" "}
                    <span className="font-mono text-xs">
                      {entity.address.slice(0, 8)}...{entity.address.slice(-6)}
                    </span>
                  </p>

                  {entity.labels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {entity.labels.map((label, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    {entity.website && (
                      <div>
                        <span className="text-xs text-gray-500">Website</span>
                        <p className="text-sm">
                          <a
                            href={entity.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            {entity.website}
                          </a>
                        </p>
                      </div>
                    )}
                    {entity.twitter && (
                      <div>
                        <span className="text-xs text-gray-500">Twitter</span>
                        <p className="text-sm">
                          <a
                            href={`https://twitter.com/${entity.twitter.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            @{entity.twitter.replace("@", "")}
                          </a>
                        </p>
                      </div>
                    )}
                    {totalUsd > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">
                          Portfolio Value
                        </span>
                        <p className="text-lg font-bold text-gray-100">
                          {formatUsd(totalUsd)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No entity data found. This may be an unlabeled wallet.
                </div>
              )}
            </div>
          )}

          {/* Balances Tab */}
          {activeTab === "balances" && (
            <div>
              {totalUsd > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                  <p className="text-xs text-gray-500">Total Portfolio Value</p>
                  <p className="text-2xl font-bold text-gray-100 mt-1">
                    {formatUsd(totalUsd)}
                  </p>
                </div>
              )}

              {balances.length > 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Chain
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Token
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Balance
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Price
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.map((b, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-800/50 hover:bg-gray-800/30"
                          >
                            <td className="px-4 py-3 text-gray-400">
                              {b.chain}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-200">
                              {b.token}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                              {b.balance.toLocaleString("en-US", {
                                maximumFractionDigits: 4,
                              })}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400">
                              ${b.priceUsd.toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-200">
                              {formatUsd(b.valueUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No balance data available.
                </div>
              )}
            </div>
          )}

          {/* Transfers Tab */}
          {activeTab === "transfers" && (
            <div>
              {transfers.length > 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            From
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            To
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Token
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Value
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            TX
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((t, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-800/50 hover:bg-gray-800/30"
                          >
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {t.time}
                            </td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                              {t.from}
                            </td>
                            <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                              {t.to}
                            </td>
                            <td className="px-4 py-3 text-gray-200 font-medium">
                              {t.token}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-200 font-medium">
                              {formatUsd(t.valueUsd)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                              {t.txHash ? (
                                <a
                                  href={`https://etherscan.io/tx/${t.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-emerald-400"
                                >
                                  {t.txHash.slice(0, 10)}...
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent transfers found.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-lg">Enter an address or click a preset to begin</p>
        </div>
      )}
    </div>
  );
}
