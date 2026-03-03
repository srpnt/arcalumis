"""
🔀 Cross-Chain Differentials
Compare rates between Ethereum and Base for same-asset markets.
"""

import streamlit as st
import pandas as pd
import altair as alt
import time
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.morpho_api import fetch_vaults, fetch_markets, MorphoAPIError

st.set_page_config(page_title="Cross-Chain Differentials — The Citadel", page_icon="🔀", layout="wide")

st.markdown("""
<style>
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1rem;
    }
    .opportunity { background-color: rgba(0, 212, 170, 0.2); padding: 0.5rem; border-radius: 4px; }
</style>
""", unsafe_allow_html=True)

st.markdown("# 🔀 Cross-Chain Rate Differentials")
st.caption("Same-asset rate comparison: Ethereum vs Base")

# --- Controls ---
col1, col2, col3 = st.columns([2, 2, 1])
with col1:
    diff_view = st.radio("Compare", ["Vaults", "Markets"], horizontal=True)
with col2:
    min_tvl = st.number_input("Min TVL ($M)", value=1.0, step=1.0, min_value=0.0)
with col3:
    refresh = st.button("🔄 Refresh", use_container_width=True)

# Auto-refresh
auto_refresh = st.sidebar.checkbox("Auto-refresh (5 min)", value=False, key="diff_auto_refresh")


@st.cache_data(ttl=300)
def load_vault_data():
    return fetch_vaults(top_n=50)


@st.cache_data(ttl=300)
def load_market_data():
    return fetch_markets(top_n=50)


if refresh:
    st.cache_data.clear()

try:
    with st.spinner("Fetching cross-chain data..."):
        if diff_view == "Vaults":
            raw = load_vault_data()
            df = pd.DataFrame(raw)

            if df.empty:
                st.warning("No vault data available.")
                st.stop()

            # Filter by minimum TVL
            df = df[df["total_assets_usd"] >= min_tvl * 1e6]

            # Split by chain
            eth_vaults = df[df["chain_id"] == 1].copy()
            base_vaults = df[df["chain_id"] == 8453].copy()

            # Group by underlying asset and find best rates
            eth_rates = eth_vaults.groupby("underlying_asset").agg(
                eth_best_apy=("net_apy", "max"),
                eth_avg_apy=("net_apy", "mean"),
                eth_tvl=("total_assets_usd", "sum"),
                eth_count=("address", "count"),
                eth_best_vault=("name", "first"),
            ).reset_index()

            base_rates = base_vaults.groupby("underlying_asset").agg(
                base_best_apy=("net_apy", "max"),
                base_avg_apy=("net_apy", "mean"),
                base_tvl=("total_assets_usd", "sum"),
                base_count=("address", "count"),
                base_best_vault=("name", "first"),
            ).reset_index()

            # Merge on asset
            merged = eth_rates.merge(base_rates, on="underlying_asset", how="inner")
            merged["spread"] = merged["eth_best_apy"] - merged["base_best_apy"]
            merged["spread_pct"] = merged["spread"] * 100
            merged = merged.sort_values("spread", ascending=False)

        else:
            raw = load_market_data()
            df = pd.DataFrame(raw)

            if df.empty:
                st.warning("No market data available.")
                st.stop()

            df = df[df["supply_usd"] >= min_tvl * 1e6]

            eth_markets = df[df["chain_id"] == 1].copy()
            base_markets = df[df["chain_id"] == 8453].copy()

            # Group by loan asset
            eth_rates = eth_markets.groupby("loan_asset").agg(
                eth_best_apy=("supply_apy", "max"),
                eth_avg_apy=("supply_apy", "mean"),
                eth_tvl=("supply_usd", "sum"),
                eth_count=("unique_key", "count"),
            ).reset_index()
            eth_rates.rename(columns={"loan_asset": "underlying_asset"}, inplace=True)

            base_rates = base_markets.groupby("loan_asset").agg(
                base_best_apy=("supply_apy", "max"),
                base_avg_apy=("supply_apy", "mean"),
                base_tvl=("supply_usd", "sum"),
                base_count=("unique_key", "count"),
            ).reset_index()
            base_rates.rename(columns={"loan_asset": "underlying_asset"}, inplace=True)

            merged = eth_rates.merge(base_rates, on="underlying_asset", how="inner")
            merged["spread"] = merged["eth_best_apy"] - merged["base_best_apy"]
            merged["spread_pct"] = merged["spread"] * 100
            merged = merged.sort_values("spread", ascending=False)

    if merged.empty:
        st.info("No cross-chain pairs found with matching assets on both chains.")
        st.stop()

    # --- Summary ---
    st.divider()
    opportunities = merged[merged["spread"] > 0.01]
    mc1, mc2, mc3 = st.columns(3)
    mc1.metric("Cross-Chain Pairs", str(len(merged)))
    mc2.metric("Opportunities (>1% spread)", str(len(opportunities)))
    mc3.metric("Max Spread", f"{merged['spread_pct'].max():.2f}%")

    st.divider()

    # --- Bar Chart ---
    st.markdown("### Rate Comparison by Asset")

    chart_data = []
    for _, row in merged.iterrows():
        asset = row["underlying_asset"]
        chart_data.append({"Asset": asset, "Chain": "Ethereum", "Best APY (%)": row["eth_best_apy"] * 100})
        chart_data.append({"Asset": asset, "Chain": "Base", "Best APY (%)": row["base_best_apy"] * 100})

    chart_df = pd.DataFrame(chart_data)

    chart = alt.Chart(chart_df).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
        x=alt.X("Asset:N", sort="-y", axis=alt.Axis(labelAngle=-45)),
        y=alt.Y("Best APY (%):Q", title="Best APY (%)"),
        color=alt.Color("Chain:N", scale=alt.Scale(
            domain=["Ethereum", "Base"],
            range=["#627eea", "#0052ff"]
        )),
        xOffset="Chain:N",
        tooltip=["Asset", "Chain", alt.Tooltip("Best APY (%):Q", format=".2f")],
    ).properties(
        height=400,
    ).configure_axis(
        labelColor="#8892b0",
        titleColor="#e0e0e0",
        gridColor="#2d3748",
    ).configure_view(
        strokeWidth=0,
    ).configure_legend(
        labelColor="#e0e0e0",
        titleColor="#e0e0e0",
    )

    st.altair_chart(chart, use_container_width=True)

    # --- Spread Table ---
    st.divider()
    st.markdown("### Spread Details")

    display_df = merged[["underlying_asset", "eth_best_apy", "base_best_apy", "spread_pct", "eth_tvl", "base_tvl"]].copy()
    display_df.columns = ["Asset", "Ethereum Best APY", "Base Best APY", "Spread (%)", "ETH TVL", "Base TVL"]

    display_df["Ethereum Best APY"] = display_df["Ethereum Best APY"].apply(lambda x: f"{x * 100:.2f}%")
    display_df["Base Best APY"] = display_df["Base Best APY"].apply(lambda x: f"{x * 100:.2f}%")
    display_df["Spread (%)"] = display_df["Spread (%)"].apply(lambda x: f"{x:.2f}%")
    display_df["ETH TVL"] = display_df["ETH TVL"].apply(
        lambda x: f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:.0f}K"
    )
    display_df["Base TVL"] = display_df["Base TVL"].apply(
        lambda x: f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:.0f}K"
    )

    def highlight_spread(row):
        styles = [""] * len(row)
        try:
            spread_val = float(row["Spread (%)"].replace("%", ""))
            if spread_val > 1.0:
                styles = ["background-color: rgba(0, 212, 170, 0.15)"] * len(row)
            elif spread_val < -1.0:
                styles = ["background-color: rgba(239, 68, 68, 0.15)"] * len(row)
        except (ValueError, AttributeError):
            pass
        return styles

    styled = display_df.reset_index(drop=True).style.apply(highlight_spread, axis=1)
    st.dataframe(styled, use_container_width=True)

    # --- Opportunities callout ---
    if not opportunities.empty:
        st.divider()
        st.markdown("### 🎯 Opportunity Highlights")
        for _, row in opportunities.iterrows():
            asset = row["underlying_asset"]
            spread = row["spread_pct"]
            eth_apy = row["eth_best_apy"] * 100
            base_apy = row["base_best_apy"] * 100
            direction = "ETH > Base" if spread > 0 else "Base > ETH"

            st.markdown(
                f"**{asset}** — {direction} by **{abs(spread):.2f}%** "
                f"(ETH: {eth_apy:.2f}% vs Base: {base_apy:.2f}%)"
            )

    st.divider()
    st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Data: Morpho GraphQL API")

except MorphoAPIError as e:
    st.error(f"❌ Morpho API Error: {e}")
except Exception as e:
    st.error(f"❌ Unexpected error: {e}")
    st.exception(e)
