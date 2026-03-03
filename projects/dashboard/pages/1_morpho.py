"""
📊 Morpho Markets Overview
Live vault and market data from Morpho protocol.
"""

import streamlit as st
import pandas as pd
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.morpho_api import fetch_vaults, fetch_markets, MorphoAPIError

st.set_page_config(page_title="Morpho Markets — The Citadel", page_icon="📊", layout="wide")

# --- CSS ---
st.markdown("""
<style>
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 10px;
        padding: 1rem 1.2rem;
    }
    .section-header {
        color: #00d4aa;
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0.5rem 0;
    }
    .citadel-footer {
        text-align: center;
        padding: 1.5rem 0 0.5rem 0;
        color: #4a5568;
        font-size: 0.8rem;
        border-top: 1px solid #1a1f2e;
        margin-top: 2rem;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("# 📊 Morpho Markets")
st.caption("Live data from Morpho GraphQL API — Ethereum & Base")

# --- Controls ---
col_ctrl1, col_ctrl2, col_ctrl3 = st.columns([3, 3, 1])

with col_ctrl1:
    chain_filter = st.radio("🔗 Chain", ["All", "Ethereum", "Base"], horizontal=True, key="chain_radio")

with col_ctrl2:
    view_mode = st.radio("📋 View", ["Vaults", "Markets"], horizontal=True)

with col_ctrl3:
    refresh = st.button("🔄 Refresh", use_container_width=True)

st.divider()

# --- Data Loading ---
@st.cache_data(ttl=300)
def load_vaults():
    return fetch_vaults(top_n=50)

@st.cache_data(ttl=300)
def load_markets():
    return fetch_markets(top_n=50)

if refresh:
    st.cache_data.clear()

try:
    with st.spinner("Fetching live data from Morpho..."):
        if view_mode == "Vaults":
            raw_data = load_vaults()
        else:
            raw_data = load_markets()

    if not raw_data:
        st.warning("No data returned from Morpho API.")
        st.stop()

    df = pd.DataFrame(raw_data)

    # --- Chain Filter ---
    chain_map = {"All": None, "Ethereum": 1, "Base": 8453}
    selected_chain = chain_map[chain_filter]
    if selected_chain is not None:
        df = df[df["chain_id"] == selected_chain]

    if df.empty:
        st.info(f"No {view_mode.lower()} found for {chain_filter}.")
        st.stop()

    # --- Summary Metrics ---
    if view_mode == "Vaults":
        total_tvl = df["total_assets_usd"].sum()
        avg_apy = df["net_apy"].mean()
        top_apy = df["net_apy"].max()
        count = len(df)

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Total Vault TVL", f"${total_tvl / 1e9:.2f}B" if total_tvl >= 1e9 else f"${total_tvl / 1e6:.1f}M")
        mc2.metric("Avg Net APY", f"{avg_apy * 100:.2f}%")
        mc3.metric("🔥 Top Net APY", f"{top_apy * 100:.2f}%")
        mc4.metric("Vaults Tracked", str(count))
    else:
        total_supply = df["supply_usd"].sum()
        total_borrow = df["borrow_usd"].sum()
        avg_util = df["utilization"].mean()
        count = len(df)

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Total Supply", f"${total_supply / 1e9:.2f}B" if total_supply >= 1e9 else f"${total_supply / 1e6:.1f}M")
        mc2.metric("Total Borrow", f"${total_borrow / 1e9:.2f}B" if total_borrow >= 1e9 else f"${total_borrow / 1e6:.1f}M")
        mc3.metric("Avg Utilization", f"{avg_util * 100:.1f}%")
        mc4.metric("Markets Tracked", str(count))

    st.divider()

    # --- Top Opportunities Section ---
    if view_mode == "Vaults":
        hot = df[df["net_apy"] > 0.08].sort_values("net_apy", ascending=False)
        if not hot.empty:
            st.markdown('<p class="section-header">🔥 Top Opportunities (>8% APY)</p>', unsafe_allow_html=True)
            top_df = hot[["name", "chain", "underlying_asset", "total_assets_usd", "net_apy"]].copy()
            st.dataframe(
                top_df,
                column_config={
                    "name": st.column_config.TextColumn("Vault", width="large"),
                    "chain": st.column_config.TextColumn("Chain", width="small"),
                    "underlying_asset": st.column_config.TextColumn("Asset", width="small"),
                    "total_assets_usd": st.column_config.NumberColumn("TVL", format="$%.0f"),
                    "net_apy": st.column_config.ProgressColumn(
                        "Net APY",
                        format="%.2f%%",
                        min_value=0,
                        max_value=hot["net_apy"].max() * 1.1 if not hot.empty else 0.5,
                    ),
                },
                hide_index=True,
                use_container_width=True,
            )
            st.divider()
    else:
        hot = df[df["supply_apy"] > 0.08].sort_values("supply_apy", ascending=False)
        if not hot.empty:
            st.markdown('<p class="section-header">🔥 Top Opportunities (>8% Supply APY)</p>', unsafe_allow_html=True)
            top_df = hot[["pair", "chain", "supply_usd", "supply_apy"]].copy()
            st.dataframe(
                top_df,
                column_config={
                    "pair": st.column_config.TextColumn("Pair", width="medium"),
                    "chain": st.column_config.TextColumn("Chain", width="small"),
                    "supply_usd": st.column_config.NumberColumn("Supply", format="$%.0f"),
                    "supply_apy": st.column_config.ProgressColumn(
                        "Supply APY",
                        format="%.2f%%",
                        min_value=0,
                        max_value=hot["supply_apy"].max() * 1.1 if not hot.empty else 0.5,
                    ),
                },
                hide_index=True,
                use_container_width=True,
            )
            st.divider()

    # --- Full Table ---
    st.markdown('<p class="section-header">📋 All ' + view_mode + '</p>', unsafe_allow_html=True)

    if view_mode == "Vaults":
        sort_by = st.selectbox("Sort by", ["TVL", "Net APY", "APY"], index=0, key="vault_sort")
        sort_col_map = {"TVL": "total_assets_usd", "Net APY": "net_apy", "APY": "apy"}
        df = df.sort_values(sort_col_map.get(sort_by, "total_assets_usd"), ascending=False)

        display_df = df[["name", "chain", "underlying_asset", "total_assets_usd", "apy", "net_apy", "fee", "num_markets"]].copy()

        st.dataframe(
            display_df,
            column_config={
                "name": st.column_config.TextColumn("Vault", width="large"),
                "chain": st.column_config.TextColumn("Chain", width="small"),
                "underlying_asset": st.column_config.TextColumn("Asset", width="small"),
                "total_assets_usd": st.column_config.NumberColumn("TVL ($)", format="$%,.0f"),
                "apy": st.column_config.NumberColumn("APY", format="%.2f%%"),
                "net_apy": st.column_config.NumberColumn("Net APY", format="%.2f%%"),
                "fee": st.column_config.NumberColumn("Fee", format="%.0f%%"),
                "num_markets": st.column_config.NumberColumn("Markets", format="%d"),
            },
            hide_index=True,
            use_container_width=True,
            height=500,
        )
    else:
        sort_by = st.selectbox("Sort by", ["Supply", "Supply APY", "Utilization"], index=0, key="market_sort")
        sort_col_map = {"Supply": "supply_usd", "Supply APY": "supply_apy", "Utilization": "utilization"}
        df = df.sort_values(sort_col_map.get(sort_by, "supply_usd"), ascending=False)

        display_df = df[["pair", "chain", "supply_usd", "borrow_usd", "utilization", "supply_apy", "borrow_apy", "lltv"]].copy()

        st.dataframe(
            display_df,
            column_config={
                "pair": st.column_config.TextColumn("Pair", width="medium"),
                "chain": st.column_config.TextColumn("Chain", width="small"),
                "supply_usd": st.column_config.NumberColumn("Supply ($)", format="$%,.0f"),
                "borrow_usd": st.column_config.NumberColumn("Borrow ($)", format="$%,.0f"),
                "utilization": st.column_config.NumberColumn("Util %", format="%.1f%%"),
                "supply_apy": st.column_config.NumberColumn("Supply APY", format="%.2f%%"),
                "borrow_apy": st.column_config.NumberColumn("Borrow APY", format="%.2f%%"),
                "lltv": st.column_config.NumberColumn("LLTV", format="%.0f%%"),
            },
            hide_index=True,
            use_container_width=True,
            height=500,
        )

    # --- Footer ---
    st.markdown(
        f'<div class="citadel-footer">'
        f'Last updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} · Data: Morpho GraphQL API<br>'
        f'Citadel v0.1 • Powered by Arcalumis 🦞'
        f'</div>',
        unsafe_allow_html=True
    )

except MorphoAPIError as e:
    st.error(f"❌ Morpho API Error: {e}")
except Exception as e:
    st.error(f"❌ Unexpected error: {e}")
    st.exception(e)
