"""
📊 Morpho Markets Overview
Live vault and market data from Morpho protocol.
"""

import streamlit as st
import pandas as pd
import time
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.morpho_api import fetch_vaults, fetch_markets, MorphoAPIError

st.set_page_config(page_title="Morpho Markets — The Citadel", page_icon="📊", layout="wide")

# --- CSS ---
st.markdown("""
<style>
    .high-apy { background-color: rgba(0, 212, 170, 0.15) !important; }
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1rem;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("# 📊 Morpho Markets Overview")
st.caption("Live data from Morpho GraphQL API — Ethereum & Base")

# --- Controls ---
col_ctrl1, col_ctrl2, col_ctrl3, col_ctrl4 = st.columns([2, 2, 2, 1])

with col_ctrl1:
    chain_filter = st.selectbox("🔗 Chain", ["All", "Ethereum", "Base"], index=0)

with col_ctrl2:
    view_mode = st.radio("View", ["Vaults", "Markets"], horizontal=True)

with col_ctrl3:
    sort_by = st.selectbox(
        "Sort by",
        ["TVL", "APY", "Utilization"] if view_mode == "Markets" else ["TVL", "Net APY", "APY"],
        index=0,
    )

with col_ctrl4:
    refresh = st.button("🔄 Refresh", use_container_width=True)

# --- Auto-refresh ---
auto_refresh = st.sidebar.checkbox("Auto-refresh (5 min)", value=False, key="morpho_auto_refresh")
if auto_refresh:
    time.sleep(0.1)  # Prevent tight loop
    st.rerun() if (time.time() % 300) < 1 else None


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
    st.divider()
    if view_mode == "Vaults":
        total_tvl = df["total_assets_usd"].sum()
        avg_apy = df["net_apy"].mean()
        top_apy = df["net_apy"].max()
        count = len(df)

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Total Vault TVL", f"${total_tvl / 1e9:.2f}B" if total_tvl >= 1e9 else f"${total_tvl / 1e6:.1f}M")
        mc2.metric("Avg Net APY", f"{avg_apy * 100:.2f}%")
        mc3.metric("Top Net APY", f"{top_apy * 100:.2f}%")
        mc4.metric("Vaults", str(count))
    else:
        total_supply = df["supply_usd"].sum()
        total_borrow = df["borrow_usd"].sum()
        avg_util = df["utilization"].mean()
        count = len(df)

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Total Supply", f"${total_supply / 1e9:.2f}B" if total_supply >= 1e9 else f"${total_supply / 1e6:.1f}M")
        mc2.metric("Total Borrow", f"${total_borrow / 1e9:.2f}B" if total_borrow >= 1e9 else f"${total_borrow / 1e6:.1f}M")
        mc3.metric("Avg Utilization", f"{avg_util * 100:.1f}%")
        mc4.metric("Markets", str(count))

    st.divider()

    # --- Table ---
    if view_mode == "Vaults":
        # Sort
        sort_col_map = {"TVL": "total_assets_usd", "Net APY": "net_apy", "APY": "apy"}
        df = df.sort_values(sort_col_map.get(sort_by, "total_assets_usd"), ascending=False)

        display_df = df[["name", "chain", "underlying_asset", "total_assets_usd", "apy", "net_apy", "fee", "num_markets"]].copy()
        display_df.columns = ["Vault", "Chain", "Asset", "TVL ($)", "APY", "Net APY", "Fee", "Markets"]

        # Format
        display_df["TVL ($)"] = display_df["TVL ($)"].apply(
            lambda x: f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:.0f}K" if x >= 1e3 else f"${x:.0f}"
        )
        display_df["APY"] = display_df["APY"].apply(lambda x: f"{x * 100:.2f}%")
        display_df["Net APY"] = display_df["Net APY"].apply(lambda x: f"{x * 100:.2f}%")
        display_df["Fee"] = display_df["Fee"].apply(lambda x: f"{x * 100:.0f}%" if x > 0 else "0%")

        # Highlight high APY
        def highlight_apy(row):
            styles = [""] * len(row)
            try:
                net_apy_val = float(row["Net APY"].replace("%", ""))
                if net_apy_val > 8:
                    styles = ["background-color: rgba(0, 212, 170, 0.15)"] * len(row)
            except (ValueError, AttributeError):
                pass
            return styles

        styled = display_df.reset_index(drop=True).style.apply(highlight_apy, axis=1)
        st.dataframe(styled, use_container_width=True, height=600)

    else:
        # Markets view
        sort_col_map = {"TVL": "supply_usd", "APY": "supply_apy", "Utilization": "utilization"}
        df = df.sort_values(sort_col_map.get(sort_by, "supply_usd"), ascending=False)

        display_df = df[["pair", "chain", "supply_usd", "borrow_usd", "utilization", "supply_apy", "borrow_apy", "lltv"]].copy()
        display_df.columns = ["Pair", "Chain", "Supply ($)", "Borrow ($)", "Utilization", "Supply APY", "Borrow APY", "LLTV"]

        display_df["Supply ($)"] = display_df["Supply ($)"].apply(
            lambda x: f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:.0f}K" if x >= 1e3 else f"${x:.0f}"
        )
        display_df["Borrow ($)"] = display_df["Borrow ($)"].apply(
            lambda x: f"${x / 1e6:.1f}M" if x >= 1e6 else f"${x / 1e3:.0f}K" if x >= 1e3 else f"${x:.0f}"
        )
        display_df["Utilization"] = display_df["Utilization"].apply(lambda x: f"{x * 100:.1f}%")
        display_df["Supply APY"] = display_df["Supply APY"].apply(lambda x: f"{x * 100:.2f}%")
        display_df["Borrow APY"] = display_df["Borrow APY"].apply(lambda x: f"{x * 100:.2f}%")
        display_df["LLTV"] = display_df["LLTV"].apply(lambda x: f"{x * 100:.0f}%")

        def highlight_supply_apy(row):
            styles = [""] * len(row)
            try:
                apy_val = float(row["Supply APY"].replace("%", ""))
                if apy_val > 8:
                    styles = ["background-color: rgba(0, 212, 170, 0.15)"] * len(row)
            except (ValueError, AttributeError):
                pass
            return styles

        styled = display_df.reset_index(drop=True).style.apply(highlight_supply_apy, axis=1)
        st.dataframe(styled, use_container_width=True, height=600)

    # --- Footer ---
    st.divider()
    st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Data: Morpho GraphQL API")

except MorphoAPIError as e:
    st.error(f"❌ Morpho API Error: {e}")
except Exception as e:
    st.error(f"❌ Unexpected error: {e}")
    st.exception(e)
