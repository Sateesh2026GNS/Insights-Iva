"""In-process TTL cache with single-flight (stampede-safe) fetches."""

from __future__ import annotations

import random
import threading
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_lock = threading.Lock()
_entries: dict[str, dict[str, Any]] = {}
_inflight: dict[str, threading.Event] = {}


def _now() -> float:
    return time.time()


def _expiry(ttl_seconds: float, jitter_fraction: float = 0.1) -> float:
    jitter = ttl_seconds * jitter_fraction * random.random()
    return _now() + ttl_seconds + jitter


def get_or_fetch(
    key: str,
    fetch: Callable[[], T],
    *,
    ttl_seconds: float,
    jitter_fraction: float = 0.1,
) -> T:
    with _lock:
        entry = _entries.get(key)
        if entry and entry.get("expires", 0) > _now() and entry.get("value") is not None:
            return entry["value"]
        if key in _inflight:
            waiter = _inflight[key]
            is_leader = False
        else:
            waiter = threading.Event()
            _inflight[key] = waiter
            is_leader = True

    if not is_leader:
        waiter.wait(timeout=120)
        with _lock:
            entry = _entries.get(key)
            if entry and entry.get("value") is not None:
                return entry["value"]
            err = entry.get("error") if entry else None
        if err:
            raise err
        return fetch()

    try:
        value = fetch()
        with _lock:
            _entries[key] = {
                "value": value,
                "expires": _expiry(ttl_seconds, jitter_fraction),
                "error": None,
            }
        return value
    except BaseException as exc:
        with _lock:
            prev = _entries.get(key) or {}
            _entries[key] = {
                "value": prev.get("value"),
                "expires": prev.get("expires", 0),
                "error": exc,
            }
        raise
    finally:
        with _lock:
            evt = _inflight.pop(key, None)
        if evt:
            evt.set()


def invalidate_prefix(prefix: str) -> None:
    with _lock:
        for k in list(_entries.keys()):
            if k.startswith(prefix):
                del _entries[k]


def clear_all() -> None:
    with _lock:
        _entries.clear()
        _inflight.clear()
