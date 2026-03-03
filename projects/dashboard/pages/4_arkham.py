"""
🔍 Arkham Intel
On-chain entity lookup via Arkham Intelligence API.
"""

import streamlit as st
import pandas as pd
from datetime import datetime

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import get_arkham_key
from utils.arkham_api import lookup_entity, get_portfolio, get_transfers, ArkhamAPIError

st.set_page_config(page_title="Arkham Intel — The Citadel", page_icon="🔍", layout="wide")

st.markdown("""
<style>
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 10px;
        padding: 1rem 1.2rem;
    }
    .entity-card {
        background: linear-gradient(135deg, #1a1f2e 0%, #141824 100%);
        border: 1px solid #2d3748;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
    }
    .entity-name {
        font-size: 1.4rem;
        font-weight: 700;
        color: #e0e0e0;
        margin-bottom: 0.3rem;
    }
    .entity-type {
        font-size: 0.85rem;
        color: #8892b0;
        margin-bottom: 0.8rem;
    }
    .tag-pill {
        display: inline-block;
        background: rgba(0, 212, 170, 0.12);
        border: 1px solid rgba(0, 212, 170, 0.25);
        color: #00d4aa;
        border-radius: 16px;
        padding: 3px 10px;
        font-size: 0.78rem;
        margin: 2px 4px 2px 0;
    }
    .quick-btn {
        background: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 0.6rem 0.8rem;
        text-align: center;
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

st.markdown("# 🔍 Arkham Intel")
st.caption("On-chain intelligence — entity and wallet analysis via Arkham Intelligence")

# --- API Key Check ---
api_key = get_arkham_key()
has_key = bool(api_key)

if not has_key:
    st.warning("⚠️ Arkham API key not configured.")
    st.markdown("""
    Add your key to `~/.openclaw/credentials/apis.json`:
    ```json
    { "arkham": { "apiKey": "your-key-here", "baseUrl": "https://api.arkm.com" } }
    ```
    """)
    st.divider()

# --- Quick Lookups ---
st.markdown('<p class="section-header">⚡ Quick Lookup</p>', unsafe_allow_html=True)

PRESET_ENTITIES = {
    "🏛 Ethereum Foundation": "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
    "💎 Vitalik.eth": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "🇺🇸 US Government": "0x0836f5ed6b62baf60b1890e0de7ee5df4ab0c0c4",
    "🏦 Coinbase": "0x503828976D22510aad0201ac7EC88293211D23Da",
    "🟡 Binance": "0x28C6c06298d514Db089934071355E5743bf21d60",
    "☀️ Justin Sun": "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296",
}

quick_cols = st.columns(len(PRESET_ENTITIES))
selected_quick = None
for i, (label, addr) in enumerate(PRESET_ENTITIES.items()):
    with quick_cols[i]:
        if st.button(label, use_container_width=True, key=f"quick_{i}"):
            selected_quick = addr

st.markdown("")

# --- Lookup Interface ---
col1, col2 = st.columns([5, 1])
with col1:
    address_input = st.text_input(
        "🔎 Wallet / Contract Address",
        value=selected_quick or "",
        placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e",
    )
with col2:
    st.markdown("")  # Spacing
    st.markdown("")
    lookup = st.button("🔍 Lookup", use_container_width=True, type="primary")

# Trigger lookup on quick button or manual click
address = address_input.strip() if address_input else ""
do_lookup = lookup or (selected_quick is not None)

st.divider()

# --- Results ---
if do_lookup and address:
    if not has_key:
        st.error("❌ Cannot perform lookup — Arkham API key not configured.")
    elif not address.startswith("0x") or len(address) != 42:
        st.error("Invalid address format. Enter a valid Ethereum address (0x + 40 hex chars).")
    else:
        tab1, tab2, tab3 = st.tabs(["📋 Entity Info", "💰 Balances", "🔄 Transfers"])

        # --- Entity Info Tab ---
        with tab1:
            try:
                with st.spinner("Looking up entity..."):
                    entity_data = lookup_entity(address)

                if entity_data and isinstance(entity_data, dict):
                    # Arkham returns different structures — handle gracefully
                    # Try arkhamEntity first, then top-level
                    entity = entity_data.get("arkhamEntity", entity_data)

                    name = entity.get("name", entity.get("label", "Unknown Entity"))
                    etype = entity.get("type", entity.get("entityType", "—"))
                    website = entity.get("website", "")
                    twitter = entity.get("twitter", "")
                    tags = entity.get("tags", entity.get("labels", []))
                    if isinstance(tags, str):
                        tags = [tags]

                    # Entity card
                    st.markdown(
                        f'<div class="entity-card">'
                        f'<div class="entity-name">{name}</div>'
                        f'<div class="entity-type">{etype} · <code>{address[:8]}...{address[-6:]}</code></div>'
                        f'</div>',
                        unsafe_allow_html=True
                    )

                    # Tags
                    if tags:
                        tag_html = " ".join(f'<span class="tag-pill">{t}</span>' for t in tags if t)
                        st.markdown(f"**Tags:** {tag_html}", unsafe_allow_html=True)

                    # Metadata
                    info_cols = st.columns(3)
                    if website:
                        info_cols[0].markdown(f"🌐 [{website}]({website})")
                    if twitter:
                        tw = twitter.lstrip("@")
                        info_cols[1].markdown(f"🐦 [@{tw}](https://twitter.com/{tw})")

                    # Additional info from the response
                    if "chain" in entity_data:
                        info_cols[2].markdown(f"⛓ Chain: {entity_data['chain']}")

                    # Raw response
                    with st.expander("🔧 Raw API Response"):
                        st.json(entity_data)
                else:
                    st.info("No entity data found for this address. It may be an unlabeled wallet.")
                    if entity_data:
                        with st.expander("🔧 Raw Response"):
                            st.json(entity_data)

            except ArkhamAPIError as e:
                st.error(f"❌ Arkham API Error: {e}")
            except Exception as e:
                st.error(f"❌ Error: {e}")

        # --- Balances Tab ---
        with tab2:
            try:
                with st.spinner("Fetching token balances..."):
                    portfolio_data = get_portfolio(address)

                if portfolio_data and isinstance(portfolio_data, dict):
                    # Arkham portfolio structure
                    chains_data = portfolio_data.get("chains", {})

                    if not chains_data:
                        # Try flat token list
                        tokens = portfolio_data.get("tokens", portfolio_data.get("balances", []))
                        if isinstance(tokens, list) and tokens:
                            df = pd.DataFrame(tokens)
                            st.dataframe(df, use_container_width=True)
                        else:
                            st.json(portfolio_data)
                    else:
                        # Per-chain breakdown
                        total_usd = 0
                        all_tokens = []

                        for chain_name, chain_data in chains_data.items():
                            if isinstance(chain_data, dict):
                                for token_addr, token_info in chain_data.items():
                                    if isinstance(token_info, dict):
                                        symbol = token_info.get("symbol", token_info.get("token", {}).get("symbol", "?"))
                                        usd_val = token_info.get("usdValue", token_info.get("valueUsd", 0))
                                        balance = token_info.get("balance", token_info.get("amount", 0))
                                        price = token_info.get("price", token_info.get("priceUsd", 0))

                                        try:
                                            usd_val = float(usd_val) if usd_val else 0
                                            balance = float(balance) if balance else 0
                                            price = float(price) if price else 0
                                        except (ValueError, TypeError):
                                            usd_val = balance = price = 0

                                        if usd_val > 0.01 or balance > 0:
                                            total_usd += usd_val
                                            all_tokens.append({
                                                "Chain": chain_name.capitalize(),
                                                "Token": symbol,
                                                "Balance": balance,
                                                "Price (USD)": price,
                                                "Value (USD)": usd_val,
                                            })

                        if all_tokens:
                            st.metric("💰 Total Portfolio Value", f"${total_usd:,.2f}")
                            st.markdown("")

                            df = pd.DataFrame(all_tokens).sort_values("Value (USD)", ascending=False)
                            st.dataframe(
                                df,
                                column_config={
                                    "Chain": st.column_config.TextColumn("Chain", width="small"),
                                    "Token": st.column_config.TextColumn("Token", width="small"),
                                    "Balance": st.column_config.NumberColumn("Balance", format="%.4f"),
                                    "Price (USD)": st.column_config.NumberColumn("Price", format="$%.2f"),
                                    "Value (USD)": st.column_config.NumberColumn("Value", format="$%,.2f"),
                                },
                                hide_index=True,
                                use_container_width=True,
                            )
                        else:
                            st.info("No token balances found.")
                            with st.expander("🔧 Raw Response"):
                                st.json(portfolio_data)

                elif portfolio_data:
                    st.json(portfolio_data)
                else:
                    st.info("No portfolio data returned.")

            except ArkhamAPIError as e:
                st.error(f"❌ Arkham API Error: {e}")
            except Exception as e:
                st.error(f"❌ Error: {e}")

        # --- Transfers Tab ---
        with tab3:
            try:
                with st.spinner("Fetching recent transfers..."):
                    transfers = get_transfers(address, limit=25)

                if transfers and isinstance(transfers, list):
                    rows = []
                    for tx in transfers:
                        if isinstance(tx, dict):
                            from_addr = tx.get("fromAddress", {})
                            to_addr = tx.get("toAddress", {})

                            from_label = ""
                            to_label = ""
                            if isinstance(from_addr, dict):
                                from_label = from_addr.get("arkhamEntity", {}).get("name", "") if isinstance(from_addr.get("arkhamEntity"), dict) else ""
                                from_display = from_label or from_addr.get("address", "?")[:12] + "..."
                            else:
                                from_display = str(from_addr)[:12] + "..."

                            if isinstance(to_addr, dict):
                                to_label = to_addr.get("arkhamEntity", {}).get("name", "") if isinstance(to_addr.get("arkhamEntity"), dict) else ""
                                to_display = to_label or to_addr.get("address", "?")[:12] + "..."
                            else:
                                to_display = str(to_addr)[:12] + "..."

                            token_info = tx.get("tokenInfo", tx.get("token", {}))
                            token_symbol = token_info.get("symbol", "?") if isinstance(token_info, dict) else "?"

                            usd_val = tx.get("unitValue", tx.get("historicalUSD", tx.get("valueUsd", 0)))
                            try:
                                usd_val = float(usd_val) if usd_val else 0
                            except (ValueError, TypeError):
                                usd_val = 0

                            ts = tx.get("blockTimestamp", tx.get("timestamp", ""))

                            rows.append({
                                "Time": ts[:19].replace("T", " ") if ts else "—",
                                "From": from_display,
                                "To": to_display,
                                "Token": token_symbol,
                                "Value (USD)": usd_val,
                                "TX Hash": tx.get("transactionHash", "")[:16] + "...",
                            })

                    if rows:
                        df = pd.DataFrame(rows)
                        st.dataframe(
                            df,
                            column_config={
                                "Time": st.column_config.TextColumn("Time", width="medium"),
                                "From": st.column_config.TextColumn("From", width="medium"),
                                "To": st.column_config.TextColumn("To", width="medium"),
                                "Token": st.column_config.TextColumn("Token", width="small"),
                                "Value (USD)": st.column_config.NumberColumn("Value", format="$%,.0f"),
                                "TX Hash": st.column_config.TextColumn("TX", width="medium"),
                            },
                            hide_index=True,
                            use_container_width=True,
                        )
                    else:
                        st.info("No transfers parsed.")

                    with st.expander("🔧 Raw Transfer Data"):
                        st.json(transfers[:3] if len(transfers) > 3 else transfers)
                else:
                    st.info("No recent transfers found for this address.")

            except ArkhamAPIError as e:
                st.error(f"❌ Arkham API Error: {e}")
            except Exception as e:
                st.error(f"❌ Error: {e}")

elif do_lookup and not address:
    st.warning("Please enter an address to look up.")

# --- Footer ---
st.markdown(
    f'<div class="citadel-footer">'
    f'Arkham Intelligence API · {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br>'
    f'Citadel v0.1 • Powered by Arcalumis 🦞'
    f'</div>',
    unsafe_allow_html=True
)
