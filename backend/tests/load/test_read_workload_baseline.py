"""
In-process concurrent read baseline (TestClient + SQLite test DB).

This is NOT a substitute for staging load tests at 500–2,000 users.
It measures local API overhead and regression trends in CI.
"""

from __future__ import annotations

import concurrent.futures
import statistics
import time

import pytest

pytestmark = pytest.mark.load


def _percentile(sorted_ms: list[float], p: float) -> float:
    if not sorted_ms:
        return 0.0
    idx = int(round((p / 100.0) * (len(sorted_ms) - 1)))
    return sorted_ms[max(0, min(idx, len(sorted_ms) - 1))]


@pytest.mark.load
def test_concurrent_read_workload_baseline(client, register_admin):
    auth = register_admin()
    headers = auth["headers"]
    endpoints = [
        ("/health", None),
        ("/auth/me", None),
        ("/api/notifications", {"limit": "20"}),
        ("/sales/customers", {"page": "1", "page_size": "25"}),
    ]

    def one_request(path_params):
        path, params = path_params
        start = time.perf_counter()
        if path == "/health":
            r = client.get(path)
        else:
            r = client.get(path, headers=headers, params=params)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        return r.status_code, elapsed_ms

    workers = 25
    rounds = 8
    jobs = [endpoints[i % len(endpoints)] for i in range(workers * rounds)]

    latencies: list[float] = []
    errors = 0
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for status, ms in pool.map(one_request, jobs):
            latencies.append(ms)
            if status >= 400:
                errors += 1
    total_s = time.perf_counter() - t0
    latencies.sort()
    p50 = _percentile(latencies, 50)
    p95 = _percentile(latencies, 95)
    p99 = _percentile(latencies, 99)
    rps = len(jobs) / total_s if total_s > 0 else 0.0

    # Soft guardrails for SQLite test harness only.
    assert errors == 0, f"baseline had HTTP errors: {errors}/{len(jobs)}"
    assert p95 < 5000, f"p95 latency regressed: {p95:.1f}ms"

    print(
        f"\n[load-baseline] requests={len(jobs)} workers={workers} "
        f"rps={rps:.1f} p50={p50:.1f}ms p95={p95:.1f}ms p99={p99:.1f}ms errors={errors}"
    )
