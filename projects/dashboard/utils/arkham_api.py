"""
Arkham Intelligence API client.
Requires API key in ~/.openclaw/credentials/apis.json
"""

import json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode
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
        url = f"{url}?{urlencode(params)}"

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
        body = ""
        try:
            body = e.read().decode()[:500]
        except Exception:
            pass
        raise ArkhamAPIError(f"HTTP {e.code}: {e.reason} — {body}") from e
    except URLError as e:
        raise ArkhamAPIError(f"Connection error: {e.reason}") from e


def lookup_entity(address: str) -> dict:
    """Look up an entity/address on Arkham Intelligence."""
    return _request(f"/intelligence/address/{address}")


def get_portfolio(address: str) -> dict:
    """Get token balances for an address."""
    return _request(f"/portfolio/v2/{address}")


def get_transfers(address: str, limit: int = 20) -> list:
    """Get recent transfers for an address."""
    data = _request("/transfers", {
        "base": address,
        "limit": str(limit),
        "usdGte": "100",
    })
    if isinstance(data, dict):
        return data.get("transfers", [])
    return data if isinstance(data, list) else []
