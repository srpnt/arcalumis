"""
🔀 Cross-Chain Differentials
Compare rates between Ethereum and Base for same-asset markets.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
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
        border-radius: 10px;
        padding: 1rem 1.2rem;
    }
    .opp-card {
        background: linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(124, 58, 237, 0.05) 100%);
        border: 1px solid rgba(0, 212, 170, 0.25);
        border-radius: 10px;
        padding: 1rem 1.2rem;
        margin-bottom: 0.8rem;
    }
    .opp-card .asset {
        font-size: 1.1rem;
        font-weight: 700;
        color: #e0e0e0;
    }
    .opp-card .spread {
        font-size: 1.3rem;
        font-weight: 800;
        color: #00d4aa;
    }
    .opp-card .detail {
        font-size: 0.85rem;
        color: #8892b0;
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

st.markdown("# 🔀 Cross-Chain Rate Differentials")
st.caption("Same-asset rate comparison: Ethereum vs Base on Morpho")

# --- Controls ---
col1, col2, col3 = st.columns([2, 2, 1])
with col1:
    diff_view = st.radio("Compare", ["Vaults", "Markets"], horizontal=True)
with col2:
    min_tvl = st.number_input("Min TVL ($M)", value=1.0, step=1.0, min_value=0.0)
with col3:
    refresh = st.button("🔄 Refresh", use_container_width=True)

st.divider()

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

            df = df[df["total_assets_usd"] >= min_tvl * 1e6]

            eth_vaults = df[df["chain_id"] == 1].copy()
            base_vaults = df[df["chain_id"] == 8453].copy()

            eth_rates = eth_vaults.groupby("underlying_asset").agg(
                eth_best_apy=("net_apy", "max"),
                eth_avg_apy=("net_apy", "mean"),
                eth_tvl=("total_assets_usd", "sum"),
                eth_count=("address", "count"),
            ).reset_index()

            base_rates = base_vaults.groupby("underlying_asset").agg(
                base_best_apy=("net_apy", "max"),
                base_avg_apy=("net_apy", "mean"),
                base_tvl=("total_assets_usd", "sum"),
                base_count=("address", "count"),
            ).reset_index()

            merged = eth_rates.merge(base_rates, on="underlying_asset", how="inner")
            merged["spread"] = merged["eth_best_apy"] - merged["base_best_apy"]
            merged["abs_spread"] = merged["spread"].abs()
            merged["spread_pct"] = merged["spread"] * 100
            merged = merged.sort_values("abs_spread", ascending=False)

        else:
            raw = load_market_data()
            df = pd.DataFrame(raw)

            if df.empty:
                st.warning("No market data available.")
                st.stop()

            df = df[df["supply_usd"] >= min_tvl * 1e6]

            eth_markets = df[df["chain_id"] == 1].copy()
            base_markets = df[df["chain_id"] == 8453].copy()

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
            merged["abs_spread"] = merged["spread"].abs()
            merged["spread_pct"] = merged["spread"] * 100
            merged = merged.sort_values("abs_spread", ascending=False)

    if merged.empty:
        st.info("No cross-chain pairs found with matching assets on both chains.")
        st.stop()

    # --- Top Arbitrage Opportunities ---
    opportunities = merged[merged["abs_spread"] > 0.01]

    mc1, mc2, mc3 = st.columns(3)
    mc1.metric("Cross-Chain Pairs", str(len(merged)))
    mc2.metric("Arb Opportunities (>1%)", str(len(opportunities)))
    mc3.metric("Max Spread", f"{merged['abs_spread'].max() * 100:.2f}%")

    st.divider()

    if not opportunities.empty:
        st.markdown('<p class="section-header">🎯 Top Arbitrage Opportunities</p>', unsafe_allow_html=True)

        for _, row in opportunities.head(5).iterrows():
            asset = row["underlying_asset"]
            spread = row["spread_pct"]
            eth_apy = row["eth_best_apy"] * 100
            base_apy = row["base_best_apy"] * 100

            if spread > 0:
                direction = "ETH ▸ Base"
                higher = "Ethereum"
            else:
                direction = "Base ▸ ETH"
                higher = "Base"

            col_l, col_r = st.columns([3, 1])
            with col_l:
                st.markdown(
                    f'<div class="opp-card">'
                    f'<span class="asset">{asset}</span> · <span class="detail">{direction}</span><br>'
                    f'<span class="detail">ETH: {eth_apy:.2f}% · Base: {base_apy:.2f}% · Higher on {higher}</span>'
                    f'</div>',
                    unsafe_allow_html=True
                )
            with col_r:
                st.markdown(
                    f'<div class="opp-card" style="text-align:center;">'
                    f'<span class="detail">Spread</span><br>'
                    f'<span class="spread">{abs(spread):.2f}%</span>'
                    f'</div>',
                    unsafe_allow_html=True
                )

        st.divider()

    # --- Plotly Horizontal Bar Chart ---
    st.markdown('<p class="section-header">📊 Rate Comparison by Asset</p>', unsafe_allow_html=True)

    chart_merged = merged.sort_values("abs_spread", ascending=True)  # ascending for horizontal bar layout

    fig = go.Figure()
    fig.add_trace(go.Bar(
        y=chart_merged["underlying_asset"],
        x=chart_merged["eth_best_apy"] * 100,
        name="Ethereum",
        orientation="h",
        marker_color="#627eea",
        text=chart_merged["eth_best_apy"].apply(lambda x: f"{x*100:.2f}%"),
        textposition="auto",
        textfont=dict(size=11),
    ))
    fig.add_trace(go.Bar(
        y=chart_merged["underlying_asset"],
        x=chart_merged["base_best_apy"] * 100,
        name="Base",
        orientation="h",
        marker_color="#0052ff",
        text=chart_merged["base_best_apy"].apply(lambda x: f"{x*100:.2f}%"),
        textposition="auto",
        textfont=dict(size=11),
    ))

    fig.update_layout(
        barmode="group",
        height=max(300, len(chart_merged) * 60),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#e0e0e0"),
        legend=dict(
            orientation="h",
            yanchor="bottom", y=1.02,
            xanchor="right", x=1,
            font=dict(size=12),
        ),
        xaxis=dict(
            title="Best APY (%)",
            gridcolor="#2d3748",
            zerolinecolor="#2d3748",
        ),
        yaxis=dict(
            title="",
            gridcolor="#2d3748",
        ),
        margin=dict(l=10, r=20, t=30, b=40),
    )

    st.plotly_chart(fig, use_container_width=True)

    # --- Spread Details Table ---
    st.divider()
    st.markdown('<p class="section-header">📋 Spread Details</p>', unsafe_allow_html=True)

    table_df = merged[["underlying_asset", "eth_best_apy", "base_best_apy", "spread", "eth_tvl", "base_tvl"]].copy()
    table_df = table_df.sort_values("spread", key=abs, ascending=False)

    st.dataframe(
        table_df,
        column_config={
            "underlying_asset": st.column_config.TextColumn("Asset", width="medium"),
            "eth_best_apy": st.column_config.NumberColumn("ETH Best APY", format="%.2f%%"),
            "base_best_apy": st.column_config.NumberColumn("Base Best APY", format="%.2f%%"),
            "spread": st.column_config.NumberColumn("Spread", format="%.2f%%"),
            "eth_tvl": st.column_config.NumberColumn("ETH TVL", format="$%,.0f"),
            "base_tvl": st.column_config.NumberColumn("Base TVL", format="$%,.0f"),
        },
        hide_index=True,
        use_container_width=True,
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
