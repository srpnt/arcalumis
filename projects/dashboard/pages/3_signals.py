"""
🚨 Signals & Alerts
Display research findings from Tank's scan files.
"""

import streamlit as st
import re
from datetime import datetime
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import get_research_files

st.set_page_config(page_title="Signals & Alerts — The Citadel", page_icon="🚨", layout="wide")

st.markdown("""
<style>
    [data-testid="stMetric"] {
        background-color: #1a1f2e;
        border: 1px solid #2d3748;
        border-radius: 8px;
        padding: 1rem;
    }
    .signal-red {
        border-left: 4px solid #ef4444;
        background-color: rgba(239, 68, 68, 0.08);
        padding: 1rem;
        border-radius: 0 8px 8px 0;
        margin-bottom: 1rem;
    }
    .signal-yellow {
        border-left: 4px solid #f59e0b;
        background-color: rgba(245, 158, 11, 0.08);
        padding: 1rem;
        border-radius: 0 8px 8px 0;
        margin-bottom: 1rem;
    }
    .signal-green {
        border-left: 4px solid #10b981;
        background-color: rgba(16, 185, 129, 0.08);
        padding: 1rem;
        border-radius: 0 8px 8px 0;
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

st.markdown("# 🚨 Signals & Alerts")
st.caption("Research findings and risk alerts from Tank's ecosystem scans")


def parse_signals(content: str) -> list[dict]:
    """Extract signals from markdown content based on emoji indicators."""
    signals = []

    # Split content into sections
    lines = content.split("\n")
    current_signal = None
    current_body = []

    for line in lines:
        # Detect signal headers with emoji indicators
        if "🔴" in line and ("Alert" in line or "Signal" in line or "#" in line):
            if current_signal:
                current_signal["body"] = "\n".join(current_body).strip()
                signals.append(current_signal)
            current_signal = {"urgency": "red", "emoji": "🔴", "title": line.strip().lstrip("#").strip(), "body": ""}
            current_body = []
        elif "🟡" in line and ("Signal" in line or "Alert" in line or "#" in line):
            if current_signal:
                current_signal["body"] = "\n".join(current_body).strip()
                signals.append(current_signal)
            current_signal = {"urgency": "yellow", "emoji": "🟡", "title": line.strip().lstrip("#").strip(), "body": ""}
            current_body = []
        elif "🟢" in line and ("Signal" in line or "Alert" in line or "Info" in line or "#" in line):
            if current_signal:
                current_signal["body"] = "\n".join(current_body).strip()
                signals.append(current_signal)
            current_signal = {"urgency": "green", "emoji": "🟢", "title": line.strip().lstrip("#").strip(), "body": ""}
            current_body = []
        elif current_signal:
            # Stop at next major heading
            if line.startswith("## ") and not any(e in line for e in ["🔴", "🟡", "🟢"]):
                current_signal["body"] = "\n".join(current_body).strip()
                signals.append(current_signal)
                current_signal = None
                current_body = []
            else:
                current_body.append(line)

    if current_signal:
        current_signal["body"] = "\n".join(current_body).strip()
        signals.append(current_signal)

    return signals


def extract_sections(content: str) -> dict[str, str]:
    """Extract major sections from the markdown."""
    sections = {}
    current_title = None
    current_lines = []

    for line in content.split("\n"):
        if line.startswith("## "):
            if current_title:
                sections[current_title] = "\n".join(current_lines).strip()
            current_title = line.lstrip("#").strip()
            current_lines = []
        elif current_title:
            current_lines.append(line)

    if current_title:
        sections[current_title] = "\n".join(current_lines).strip()

    return sections


# --- Load research files ---
research_files = get_research_files()

if not research_files:
    st.warning("No research files found in the research directory.")
    st.stop()

# --- File selector ---
col1, col2 = st.columns([3, 1])
with col1:
    selected_file = st.selectbox(
        "📁 Research File",
        research_files,
        format_func=lambda p: p.name,
    )
with col2:
    view_type = st.radio("View", ["Signals", "Full Report"], horizontal=True)

st.divider()

# --- Read and parse ---
try:
    content = selected_file.read_text()
except Exception as e:
    st.error(f"Failed to read file: {e}")
    st.stop()

if view_type == "Signals":
    signals = parse_signals(content)

    if not signals:
        st.info("No signal markers (🔴🟡🟢) found in this file. Switch to Full Report view.")
        st.stop()

    # --- Summary ---
    red_count = sum(1 for s in signals if s["urgency"] == "red")
    yellow_count = sum(1 for s in signals if s["urgency"] == "yellow")
    green_count = sum(1 for s in signals if s["urgency"] == "green")

    mc1, mc2, mc3, mc4 = st.columns(4)
    mc1.metric("Total Signals", str(len(signals)))
    mc2.metric("🔴 Critical", str(red_count))
    mc3.metric("🟡 Warning", str(yellow_count))
    mc4.metric("🟢 Info", str(green_count))

    st.divider()

    # --- Filter ---
    urgency_filter = st.multiselect(
        "Filter by urgency",
        ["🔴 Critical", "🟡 Warning", "🟢 Info"],
        default=["🔴 Critical", "🟡 Warning", "🟢 Info"],
    )

    filter_map = {"🔴 Critical": "red", "🟡 Warning": "yellow", "🟢 Info": "green"}
    active_filters = {filter_map[f] for f in urgency_filter}

    # --- Display signals ---
    for signal in signals:
        if signal["urgency"] not in active_filters:
            continue

        css_class = f"signal-{signal['urgency']}"
        with st.container():
            st.markdown(f'<div class="{css_class}">', unsafe_allow_html=True)
            st.markdown(f"**{signal['title']}**")
            if signal["body"]:
                st.markdown(signal["body"])
            st.markdown("</div>", unsafe_allow_html=True)
            st.markdown("")

else:
    # Full report view
    sections = extract_sections(content)

    if sections:
        # Section navigator
        section_names = list(sections.keys())
        selected_section = st.selectbox("Jump to section", ["Full Document"] + section_names)

        st.divider()

        if selected_section == "Full Document":
            st.markdown(content)
        else:
            st.markdown(f"## {selected_section}")
            st.markdown(sections[selected_section])
    else:
        st.markdown(content)

st.divider()
st.caption(f"Source: {selected_file.name} | Rendered: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
