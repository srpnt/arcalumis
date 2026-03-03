"""
🚨 Signals & Alerts
Display research findings from Tank's scan files.
"""

import streamlit as st
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
        border-radius: 10px;
        padding: 1rem 1.2rem;
    }

    /* Signal cards */
    .signal-card {
        border-radius: 10px;
        padding: 1.2rem 1.5rem;
        margin-bottom: 1rem;
        border-left: 5px solid;
    }
    .signal-card-red {
        border-left-color: #ef4444;
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%);
        border-top: 1px solid rgba(239, 68, 68, 0.15);
        border-right: 1px solid rgba(239, 68, 68, 0.08);
        border-bottom: 1px solid rgba(239, 68, 68, 0.08);
    }
    .signal-card-yellow {
        border-left-color: #f59e0b;
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%);
        border-top: 1px solid rgba(245, 158, 11, 0.15);
        border-right: 1px solid rgba(245, 158, 11, 0.08);
        border-bottom: 1px solid rgba(245, 158, 11, 0.08);
    }
    .signal-card-green {
        border-left-color: #10b981;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%);
        border-top: 1px solid rgba(16, 185, 129, 0.15);
        border-right: 1px solid rgba(16, 185, 129, 0.08);
        border-bottom: 1px solid rgba(16, 185, 129, 0.08);
    }
    .signal-title {
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 0.3rem;
    }
    .signal-meta {
        font-size: 0.78rem;
        color: #8892b0;
        margin-bottom: 0.5rem;
    }
    .signal-body {
        font-size: 0.9rem;
        color: #cbd5e0;
        line-height: 1.5;
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

st.markdown("# 🚨 Signals & Alerts")
st.caption("Research findings and risk alerts from Tank's ecosystem scans")


def parse_signals(content: str, source_name: str = "") -> list[dict]:
    """Extract signals from markdown content based on emoji indicators."""
    signals = []
    lines = content.split("\n")
    current_signal = None
    current_body = []

    for line in lines:
        # Detect signal headers with emoji indicators
        is_signal = False
        urgency = None
        emoji = None

        if "🔴" in line and any(kw in line for kw in ["Alert", "Signal", "#"]):
            is_signal, urgency, emoji = True, "red", "🔴"
        elif "🟡" in line and any(kw in line for kw in ["Signal", "Alert", "#"]):
            is_signal, urgency, emoji = True, "yellow", "🟡"
        elif "🟢" in line and any(kw in line for kw in ["Signal", "Alert", "Info", "#"]):
            is_signal, urgency, emoji = True, "green", "🟢"

        if is_signal:
            if current_signal:
                current_signal["body"] = "\n".join(current_body).strip()
                signals.append(current_signal)
            current_signal = {
                "urgency": urgency,
                "emoji": emoji,
                "title": line.strip().lstrip("#").strip(),
                "body": "",
                "source": source_name,
            }
            current_body = []
        elif current_signal:
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
    st.info("Place `.md` files in `~/.openclaw/workspace/research/` with signal markers (🔴🟡🟢) to see them here.")
    st.stop()

# --- Controls ---
col1, col2 = st.columns([3, 1])
with col1:
    selected_file = st.selectbox(
        "📁 Research File",
        research_files,
        format_func=lambda p: f"📄 {p.name}",
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
    signals = parse_signals(content, source_name=selected_file.name)

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

    # --- Display signal cards ---
    for signal in signals:
        if signal["urgency"] not in active_filters:
            continue

        urgency = signal["urgency"]
        css_class = f"signal-card signal-card-{urgency}"

        urgency_label = {"red": "CRITICAL", "yellow": "WARNING", "green": "INFO"}[urgency]
        urgency_color = {"red": "#ef4444", "yellow": "#f59e0b", "green": "#10b981"}[urgency]

        # Card header
        st.markdown(
            f'<div class="{css_class}">'
            f'<div class="signal-title">{signal["title"]}</div>'
            f'<div class="signal-meta">'
            f'<span style="color:{urgency_color};font-weight:600;">{urgency_label}</span>'
            f' · Source: {signal.get("source", "—")}'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True
        )

        # Expandable body
        if signal["body"]:
            with st.expander("📖 Details", expanded=(urgency == "red")):
                st.markdown(signal["body"])

else:
    # Full report view
    sections = extract_sections(content)

    if sections:
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

# --- Footer ---
st.markdown(
    f'<div class="citadel-footer">'
    f'Source: {selected_file.name} · Rendered: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br>'
    f'Citadel v0.1 • Powered by Arcalumis 🦞'
    f'</div>',
    unsafe_allow_html=True
)
