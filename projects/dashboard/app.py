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
    /* Main header */
    .citadel-header {
        text-align: center;
        padding: 1rem 0;
        border-bottom: 1px solid #2d3748;
        margin-bottom: 2rem;
    }
    .citadel-header h1 {
        font-size: 2.5rem;
        background: linear-gradient(135deg, #00d4aa, #7c3aed);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .citadel-header p {
        color: #8892b0;
        font-size: 1rem;
    }

    /* Metric cards */
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1rem;
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #0a0e17;
    }

    /* Tables */
    .stDataFrame {
        border-radius: 8px;
    }

    /* Status indicator */
    .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 6px;
    }
    .status-live { background-color: #00d4aa; }
    .status-stale { background-color: #f59e0b; }
    .status-dead { background-color: #ef4444; }
</style>
""", unsafe_allow_html=True)

# --- Header ---
st.markdown("""
<div class="citadel-header">
    <h1>🏰 The Citadel</h1>
    <p>DeFi Intelligence Command Center</p>
</div>
""", unsafe_allow_html=True)

# --- Sidebar ---
with st.sidebar:
    st.markdown("### ⚡ System Status")
    st.markdown(f'<span class="status-dot status-live"></span> Online — {datetime.now().strftime("%H:%M:%S")}', unsafe_allow_html=True)

    st.divider()
    st.markdown("### 🧭 Navigation")
    st.markdown("""
    - **📊 Morpho Markets** — Vault & market overview
    - **🔀 Cross-Chain** — Rate differentials
    - **🚨 Signals** — Research & alerts
    - **🔍 Arkham Intel** — Wallet lookup
    """)

    st.divider()
    st.markdown("### 🛠 Config")
    auto_refresh = st.checkbox("Auto-refresh (5 min)", value=False, key="global_auto_refresh")
    if auto_refresh:
        st.markdown("*Next refresh in ~5 min*")

    st.divider()
    st.caption("Built by Trinity for The Crew")
    st.caption("Morpho • Arkham • DeFiLlama")

# --- Main Content ---
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("📊 Morpho Markets", "→", help="Navigate to Morpho Markets page")
with col2:
    st.metric("🔀 Differentials", "→", help="Navigate to Cross-Chain Differentials page")
with col3:
    st.metric("🚨 Signals", "→", help="Navigate to Signals & Alerts page")
with col4:
    st.metric("🔍 Arkham", "→", help="Navigate to Arkham Intel page")

st.divider()

st.markdown("""
### Welcome to The Citadel

Your central command interface for DeFi intelligence. Use the sidebar to navigate between modules:

| Module | Description |
|--------|-------------|
| **Morpho Markets** | Live vault & market data from Morpho protocol (Ethereum + Base) |
| **Cross-Chain Differentials** | Rate spread analysis between chains |
| **Signals & Alerts** | Research findings and risk alerts from Tank's scans |
| **Arkham Intel** | On-chain entity lookup via Arkham Intelligence API |

---

*Select a page from the sidebar to begin.*
""")
