export interface CuratorVault {
  address: string;
  name: string;
  chainId: number;
  chainNetwork: string;
  assetSymbol: string;
  totalAssetsUsd: number;
  netApy: number;
}

export interface CuratorData {
  id: string;
  name: string;
  image: string | null;
  verified: boolean;
  addresses: { chainId: number; address: string }[];
  aum: number;
  vaults: CuratorVault[];
  vaultsLoading: boolean;
}

export interface TokenTransfer {
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

export interface VaultConcentrationEntry {
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

export type PageTab = "curators" | "tokenActivity" | "vaultConcentration";
