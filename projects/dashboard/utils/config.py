"""
Configuration loader — reads credentials from apis.json.
"""

import json
from pathlib import Path

CREDENTIALS_PATH = Path.home() / ".openclaw" / "credentials" / "apis.json"
RESEARCH_DIR = Path.home() / ".openclaw" / "workspace" / "research"


def load_credentials() -> dict:
    """Load API credentials from the credentials file."""
    if not CREDENTIALS_PATH.exists():
        return {}
    try:
        with open(CREDENTIALS_PATH) as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def get_arkham_key() -> str:
    """Get Arkham API key."""
    creds = load_credentials()
    arkham = creds.get("arkham", {})
    # Support both key formats
    return arkham.get("apiKey", arkham.get("api_key", ""))


def get_arkham_base_url() -> str:
    """Get Arkham API base URL."""
    creds = load_credentials()
    arkham = creds.get("arkham", {})
    return arkham.get("baseUrl", arkham.get("base_url", "https://api.arkm.com"))


def get_research_files() -> list[Path]:
    """Get all markdown research files."""
    if not RESEARCH_DIR.exists():
        return []
    return sorted(RESEARCH_DIR.glob("*.md"), reverse=True)
