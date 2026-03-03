"""
🔍 Arkham Intel
On-chain entity lookup via Arkham Intelligence API.
"""

import streamlit as st
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import get_arkham_key
from utils.arkham_api import lookup_entity, get_portfolio, ArkhamAPIError

st.set_page_config(page_title="Arkham Intel — The Citadel", page_icon="🔍", layout="wide")

st.markdown("""
<style>
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1rem;
    }
    .entity-card {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("# 🔍 Arkham Intel")
st.caption("On-chain intelligence — entity and wallet analysis")

# --- API Key Check ---
api_key = get_arkham_key()
if not api_key:
    st.warning("⚠️ Arkham API key not configured.")
    st.markdown("""
    To enable Arkham Intelligence lookups:

    1. Get an API key from [Arkham Intelligence](https://www.arkhamintelligence.com/)
    2. Add it to `~/.openclaw/workspace/credentials/apis.json`:

    ```json
    {
        "arkham": {
            "api_key": "your-key-here",
            "base_url": "https://api.arkhamintelligence.com"
        }
    }
    ```

    3. Refresh this page.
    """)
    st.divider()

# --- Lookup Interface ---
st.markdown("### 🔎 Address Lookup")

col1, col2 = st.columns([4, 1])
with col1:
    address = st.text_input(
        "Wallet / Contract Address",
        placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e",
        label_visibility="collapsed",
    )
with col2:
    lookup = st.button("🔍 Lookup", use_container_width=True, type="primary")

# --- Quick Access ---
st.markdown("#### Quick Lookups")
quick_cols = st.columns(4)
quick_addresses = {
    "Ethereum Foundation": "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
    "Vitalik.eth": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "Justin Sun": "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296",
    "Binance Hot Wallet": "0x28C6c06298d514Db089934071355E5743bf21d60",
}

for i, (name, addr) in enumerate(quick_addresses.items()):
    with quick_cols[i]:
        if st.button(name, use_container_width=True, key=f"quick_{i}"):
            address = addr
            lookup = True

st.divider()

# --- Results ---
if lookup and address:
    if not api_key:
        st.error("❌ Cannot perform lookup — Arkham API key not configured.")
    else:
        address = address.strip()

        # Validate address format
        if not address.startswith("0x") or len(address) != 42:
            st.error("Invalid address format. Please enter a valid Ethereum address (0x...)")
        else:
            tab1, tab2 = st.tabs(["📋 Entity Info", "💰 Portfolio"])

            with tab1:
                try:
                    with st.spinner("Looking up entity..."):
                        entity_data = lookup_entity(address)

                    if entity_data:
                        st.markdown('<div class="entity-card">', unsafe_allow_html=True)

                        # Try to extract entity info
                        if isinstance(entity_data, dict):
                            name = entity_data.get("name", entity_data.get("label", "Unknown"))
                            entity_type = entity_data.get("type", "Unknown")
                            chain = entity_data.get("chain", "Ethereum")

                            st.markdown(f"### {name}")
                            ec1, ec2, ec3 = st.columns(3)
                            ec1.metric("Type", entity_type)
                            ec2.metric("Chain", chain)
                            ec3.metric("Address", f"{address[:6]}...{address[-4:]}")

                            if "tags" in entity_data:
                                st.markdown("**Tags:** " + ", ".join(entity_data["tags"]))

                            if "description" in entity_data:
                                st.markdown(f"**Description:** {entity_data['description']}")

                        st.markdown("</div>", unsafe_allow_html=True)

                        # Raw data expander
                        with st.expander("Raw Response"):
                            st.json(entity_data)
                    else:
                        st.info("No entity data found for this address.")

                except ArkhamAPIError as e:
                    st.error(f"❌ Arkham API Error: {e}")
                except Exception as e:
                    st.error(f"❌ Error: {e}")

            with tab2:
                try:
                    with st.spinner("Fetching portfolio..."):
                        portfolio_data = get_portfolio(address)

                    if portfolio_data:
                        if isinstance(portfolio_data, dict):
                            # Try to extract balances
                            balances = portfolio_data.get("balances", portfolio_data.get("tokens", []))

                            if isinstance(balances, list) and balances:
                                import pandas as pd
                                df = pd.DataFrame(balances)
                                st.dataframe(df, use_container_width=True)
                            else:
                                st.json(portfolio_data)
                        else:
                            st.json(portfolio_data)
                    else:
                        st.info("No portfolio data found.")

                except ArkhamAPIError as e:
                    st.error(f"❌ Arkham API Error: {e}")
                except Exception as e:
                    st.error(f"❌ Error: {e}")

elif lookup and not address:
    st.warning("Please enter an address to look up.")

# --- Footer ---
st.divider()
st.caption(f"Arkham Intelligence API | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
