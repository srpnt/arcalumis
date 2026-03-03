"""
Arkham Intelligence API client (placeholder).
Requires API key in credentials/apis.json.
"""

import json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from utils.config import get_arkham_key, get_arkham_base_url


class ArkhamAPIError(Exception):
    pass


def _request(endpoint: str, params: dict | None = None) -> dict:
    """Make an authenticated GET request to Arkham API."""
    api_key = get_arkham_key()
    base_url = get_arkham_base_url()

    if not api_key:
        raise ArkhamAPIError("No Arkham API key configured. Add it to credentials/apis.json")

    url = f"{base_url}{endpoint}"
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"

    req = Request(
        url,
        headers={
            "API-Key": api_key,
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        raise ArkhamAPIError(f"HTTP {e.code}: {e.reason}") from e
    except URLError as e:
        raise ArkhamAPIError(f"Connection error: {e.reason}") from e


def lookup_entity(address: str) -> dict:
    """Look up an entity/address on Arkham."""
    return _request("/intelligence/address", {"address": address})


def get_portfolio(address: str) -> dict:
    """Get portfolio/balances for an address."""
    return _request("/portfolio/v2", {"address": address})


def get_transfers(address: str, limit: int = 20) -> dict:
    """Get recent transfers for an address."""
    return _request("/transfers", {"address": address, "limit": str(limit)})
