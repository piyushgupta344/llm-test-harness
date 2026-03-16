"""
Deterministic SHA-256 hash for cassette requests.

This implementation MUST produce byte-for-byte identical hashes to the TypeScript version
in packages/llm-test-harness/src/cassette/cassette-hash.ts for the same logical request.

Key invariants:
- All object keys are sorted alphabetically (matching JSON.stringify with sortKeys)
- Numeric integers stored as floats (e.g. 0.0) are normalized to int (e.g. 0) to match
  JavaScript's JSON.stringify behaviour which never emits "0.0", only "0"
- Separators are (',', ':') — no spaces
- ensure_ascii=False — Unicode preserved as-is
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from ..types import CassetteRequest


def _normalize_number(v: Any) -> Any:
    """Convert float-integers (e.g. 0.0, 1.0) to int so JSON output matches JavaScript."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def _sort_keys(value: Any) -> Any:
    """Recursively sort all object keys alphabetically."""
    if isinstance(value, list):
        return [_sort_keys(v) for v in value]
    if isinstance(value, dict):
        return {k: _sort_keys(v) for k, v in sorted(value.items())}
    return _normalize_number(value)


def _build_canonical(req: CassetteRequest) -> dict[str, Any]:
    return {
        "messages": [{"content": m.content, "role": m.role} for m in req.messages],
        "model": req.model,
        "params": {
            "max_tokens": req.params.max_tokens,
            "stop": req.params.stop,
            "temperature": req.params.temperature,
            "top_p": req.params.top_p,
        },
        "provider": req.provider,
        "system": req.system,
        "tools": sorted(
            [{"description": t.description, "name": t.name} for t in req.tools],
            key=lambda t: t["name"],
        )
        if req.tools
        else None,
    }


def hash_request(req: CassetteRequest) -> str:
    """
    Produces a deterministic SHA-256 hash for a cassette request.
    Identical to the TypeScript hashRequest() for the same logical input.
    """
    canonical = _sort_keys(_build_canonical(req))
    json_str = json.dumps(canonical, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(json_str.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"
