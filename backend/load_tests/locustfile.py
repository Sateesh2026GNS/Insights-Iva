"""
Locust load tests for Insights Iva (staging / dedicated test DB only).

Usage (from backend/):
  pip install locust
  locust -f load_tests/locustfile.py --host=http://127.0.0.1:8000

Set environment variables before running:
  LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD, LOAD_TEST_ROLE (optional, default Admin)

Do NOT point at production.

Pool sizing: each API process allows at most DB_POOL_SIZE + DB_MAX_OVERFLOW
connections (default 50). Concurrent Locust users can exceed that; requests then
wait up to DB_POOL_TIMEOUT seconds and return 503 (pool timeout). Scale with
multiple API instances behind a load balancer, or lower Locust user count on a
single worker. See load_tests/pool_capacity_report.py and STAGING_MULTI_INSTANCE.md.
"""

import os

from locust import HttpUser, between, task


class ErpUser(HttpUser):
    wait_time = between(0.5, 2.5)
    token: str | None = None

    def on_start(self):
        preset = os.environ.get("LOAD_TEST_ACCESS_TOKEN", "").strip()
        if preset:
            self.token = preset
            return
        email = os.environ.get("LOAD_TEST_EMAIL", "").strip()
        password = os.environ.get("LOAD_TEST_PASSWORD", "").strip()
        role = os.environ.get("LOAD_TEST_ROLE", "Admin").strip()
        if not email or not password:
            return
        with self.client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": role},
            name="/auth/login",
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")

    def _auth_headers(self):
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}

    @task(1)
    def login_refresh(self):
        """Low-weight login sample (most users reuse LOAD_TEST_ACCESS_TOKEN)."""
        if os.environ.get("LOAD_TEST_ACCESS_TOKEN"):
            return
        email = os.environ.get("LOAD_TEST_EMAIL", "").strip()
        password = os.environ.get("LOAD_TEST_PASSWORD", "").strip()
        role = os.environ.get("LOAD_TEST_ROLE", "Admin").strip()
        if not email or not password:
            return
        self.client.post(
            "/auth/login",
            json={"email": email, "password": password, "role": role},
            name="/auth/login",
        )

    @task(3)
    def health(self):
        self.client.get("/health", name="/health")

    @task(5)
    def me(self):
        if not self.token:
            return
        self.client.get("/auth/me", headers=self._auth_headers(), name="/auth/me")

    @task(4)
    def notifications(self):
        if not self.token:
            return
        self.client.get(
            "/api/notifications",
            headers=self._auth_headers(),
            name="/api/notifications",
            params={"limit": 20},
        )

    @task(3)
    def customers_page(self):
        if not self.token:
            return
        self.client.get(
            "/sales/customers",
            headers=self._auth_headers(),
            name="/sales/customers",
            params={"page": 1, "page_size": 25},
        )

    @task(2)
    def inventory_items(self):
        if not self.token:
            return
        self.client.get(
            "/inventory/items",
            headers=self._auth_headers(),
            name="/inventory/items",
            params={"page": 1, "page_size": 25},
        )

    @task(2)
    def sales_hub(self):
        if not self.token:
            return
        self.client.get(
            "/sales/hub",
            headers=self._auth_headers(),
            name="/sales/hub",
        )

    @task(3)
    def erp_dashboard(self):
        if not self.token:
            return
        self.client.get(
            "/api/erp/dashboard",
            headers=self._auth_headers(),
            name="/api/erp/dashboard",
        )

    @task(2)
    def inventory_dashboard(self):
        if not self.token:
            return
        self.client.get(
            "/inventory/dashboard",
            headers=self._auth_headers(),
            name="/inventory/dashboard",
        )
