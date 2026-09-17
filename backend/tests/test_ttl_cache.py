"""TTL cache single-flight behavior."""

import threading
import time

from app.utils.ttl_cache import clear_all, get_or_fetch


def test_single_flight_only_runs_fetch_once():
    clear_all()
    calls = {"n": 0}
    lock = threading.Lock()

    def fetch():
        with lock:
            calls["n"] += 1
        time.sleep(0.05)
        return {"ok": True}

    results = []

    def worker():
        results.append(get_or_fetch("tenant:1:key", fetch, ttl_seconds=30))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert calls["n"] == 1
    assert all(r == {"ok": True} for r in results)


def test_tenant_keys_are_isolated():
    clear_all()

    def fetch_a():
        return "a"

    def fetch_b():
        return "b"

    assert get_or_fetch("report_summary:tenant:1:x", fetch_a, ttl_seconds=60) == "a"
    assert get_or_fetch("report_summary:tenant:2:x", fetch_b, ttl_seconds=60) == "b"
