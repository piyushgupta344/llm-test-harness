from __future__ import annotations

from typing import Optional

from ..errors import CassetteMissError
from ..types import CassetteInteraction, CassetteRequest
from .hash import hash_request
from .store import CassetteStore


def find_interaction(store: CassetteStore, req: CassetteRequest) -> Optional[CassetteInteraction]:
    hash_ = hash_request(req)
    return store.find_by_id(hash_)


def require_interaction(store: CassetteStore, req: CassetteRequest) -> CassetteInteraction:
    hash_ = hash_request(req)
    interaction = store.find_by_id(hash_)
    if interaction is None:
        raise CassetteMissError(hash_)
    return interaction
