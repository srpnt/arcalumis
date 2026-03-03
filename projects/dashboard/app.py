"""
The Citadel — DeFi Intelligence Command Center
Main application entry point.
"""

import streamlit as st
from datetime import datetime

st.set_page_config(
    page_title="The Citadel",
    page_icon="🏰",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Custom CSS ---
st.markdown("""
<style>
    /* Hero section */
    .citadel-hero {
        text-align: center;
        padding: 2rem 0 1.5rem 0;
        margin-bottom: 1.5rem;
    }
    .citadel-hero h1 {
        font-size: 3rem;
        background: linear-gradient(135deg, #00d4aa 0%, #7c3aed 50%, #00d4aa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.3rem;
        font-weight: 800;
        letter-spacing: -0.02em;
    }
    .citadel-hero .subtitle {
        color: #8892b0;
        font-size: 1.1rem;
        font-weight: 300;
        letter-spacing: 0.15em;
        text-transform: uppercase;
    }

    /* Metric cards */
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 10px;
        padding: 1rem 1.2rem;
    }
    [data-testid="stMetricLabel"] {
        font-size: 0.85rem !important;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #0a0e17;
    }

    /* Nav cards */
    .nav-card {
        background: linear-gradient(135deg, #1a1f2e 0%, #141824 100%);
        border: 1px solid #2d3748;
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        transition: border-color 0.2s;
        min-height: 140px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .nav-card:hover {
        border-color: #00d4aa;
    }
    .nav-card .icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    .nav-card .title {
        font-size: 1rem;
        font-weight: 600;
        color: #e0e0e0;
        margin-bottom: 0.3rem;
    }
    .nav-card .desc {
        font-size: 0.8rem;
        color: #8892b0;
    }

    /* Status badge */
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 212, 170, 0.1);
        border: 1px solid rgba(0, 212, 170, 0.3);
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 0.8rem;
        color: #00d4aa;
    }
    .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #00d4aa;
        animation: pulse 2s infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }

    /* Footer */
    .citadel-footer {
        text-align: center;
        padding: 1.5rem 0 0.5rem 0;
        color: #4a5568;
        font-size: 0.8rem;
        border-top: 1px solid #1a1f2e;
        margin-top: 2rem;
    }

    /* Divider override */
    hr {
        border-color: #1e2433 !important;
    }
</style>
""", unsafe_allow_html=True)

# --- Hero Section ---
st.markdown("""
<div class="citadel-hero">
    <h1>🏰 The Citadel</h1>
    <p class="subtitle">DeFi Intelligence Command Center</p>
</div>
""", unsafe_allow_html=True)

# --- Sidebar ---
now = datetime.now()
with st.sidebar:
    st.markdown(
        f'<div style="text-align:center; margin-bottom:1rem;">'
        f'<span class="status-badge"><span class="status-dot"></span>Online</span>'
        f'</div>',
        unsafe_allow_html=True
    )
    st.caption(f"🕐 {now.strftime('%H:%M:%S %Z')} · {now.strftime('%d %b %Y')}")

    st.divider()
    st.markdown("### 🧭 Navigation")
    st.page_link("app.py", label="🏰 Home", icon="🏠")
    st.page_link("pages/1_morpho.py", label="📊 Morpho Markets")
    st.page_link("pages/2_differentials.py", label="🔀 Cross-Chain Differentials")
    st.page_link("pages/3_signals.py", label="🚨 Signals & Alerts")
    st.page_link("pages/4_arkham.py", label="🔍 Arkham Intel")

    st.divider()
    st.markdown("### 🛠 Settings")
    auto_refresh = st.checkbox("Auto-refresh (5 min)", value=False, key="global_auto_refresh")
    if auto_refresh:
        st.caption("⏱ Next refresh in ~5 min")

    st.divider()
    st.markdown(
        '<div style="text-align:center;color:#4a5568;font-size:0.75rem;">'
        'Citadel v0.1 • Powered by Arcalumis 🦞'
        '</div>',
        unsafe_allow_html=True
    )

# --- Summary Metrics ---
# Try to load real data for the homepage summary
from utils.morpho_api import fetch_vaults, fetch_markets, MorphoAPIError
from utils.config import get_research_files

@st.cache_data(ttl=300)
def _home_vaults():
    try:
        return fetch_vaults(top_n=50)
    except Exception:
        return []

@st.cache_data(ttl=300)
def _home_markets():
    try:
        return fetch_markets(top_n=50)
    except Exception:
        return []

vaults = _home_vaults()
markets = _home_markets()
signals_files = get_research_files()

import pandas as pd

total_tvl = 0
best_yield = 0
vault_count = len(vaults)
market_count = len(markets)

if vaults:
    vdf = pd.DataFrame(vaults)
    total_tvl = vdf["total_assets_usd"].sum()
    best_yield = vdf["net_apy"].max() * 100

if markets:
    mdf = pd.DataFrame(markets)
    total_tvl += mdf["supply_usd"].sum()

col1, col2, col3, col4 = st.columns(4)
with col1:
    tvl_str = f"${total_tvl/1e9:.2f}B" if total_tvl >= 1e9 else f"${total_tvl/1e6:.0f}M"
    st.metric("💰 Total TVL Tracked", tvl_str)
with col2:
    st.metric("📈 Best Vault Yield", f"{best_yield:.1f}%")
with col3:
    st.metric("🏦 Vaults / Markets", f"{vault_count} / {market_count}")
with col4:
    st.metric("📄 Research Files", str(len(signals_files)))

st.markdown("")

# --- Last Refreshed ---
st.caption(f"📡 Last refreshed: {now.strftime('%Y-%m-%d %H:%M:%S')}")

st.divider()

# --- Navigation Cards ---
st.markdown("### Modules")
st.markdown("")

nc1, nc2, nc3, nc4 = st.columns(4)

with nc1:
    st.markdown("""
    <div class="nav-card">
        <div class="icon">📊</div>
        <div class="title">Morpho Markets</div>
        <div class="desc">Live vault & market data from Morpho on Ethereum + Base</div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/1_morpho.py", label="Open Morpho →", use_container_width=True)

with nc2:
    st.markdown("""
    <div class="nav-card">
        <div class="icon">🔀</div>
        <div class="title">Cross-Chain</div>
        <div class="desc">Rate spread analysis between Ethereum and Base</div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/2_differentials.py", label="Open Differentials →", use_container_width=True)

with nc3:
    st.markdown("""
    <div class="nav-card">
        <div class="icon">🚨</div>
        <div class="title">Signals</div>
        <div class="desc">Research findings and risk alerts from Tank's scans</div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/3_signals.py", label="Open Signals →", use_container_width=True)

with nc4:
    st.markdown("""
    <div class="nav-card">
        <div class="icon">🔍</div>
        <div class="title">Arkham Intel</div>
        <div class="desc">On-chain entity lookup via Arkham Intelligence</div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/4_arkham.py", label="Open Arkham →", use_container_width=True)

# --- Footer ---
st.markdown(
    '<div class="citadel-footer">Citadel v0.1 • Powered by Arcalumis 🦞</div>',
    unsafe_allow_html=True
)
