"""Start a localhost-only disposable PostgreSQL cluster for tests.

Does not touch the developer insights_iva database. Data lives under
the process TEMP directory and listens on 127.0.0.1:55432.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

PG_BIN = Path(r"C:\Program Files\PostgreSQL\18\bin")
PORT = 55432
DATA_DIR = Path(os.environ.get("TEMP", str(Path.home() / "AppData" / "Local" / "Temp"))) / "insights_iva_pg_test"
TEST_DB = "insights_iva_test"
APP_USER = "insights_user"
APP_PASSWORD = "insights_test_only"


def _run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs)


def _pg_is_ready() -> bool:
    exe = PG_BIN / "pg_isready.exe"
    result = subprocess.run(
        [str(exe), "-h", "127.0.0.1", "-p", str(PORT), "-d", "postgres"],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def start() -> int:
    if _pg_is_ready():
        print(f"already_running port={PORT}")
        print(f"data_dir={DATA_DIR}")
        print(f"database={TEST_DB}")
        return 0

    DATA_DIR.parent.mkdir(parents=True, exist_ok=True)
    pg_version = DATA_DIR / "PG_VERSION"
    if not pg_version.exists():
        if DATA_DIR.exists():
            shutil.rmtree(DATA_DIR, ignore_errors=True)
        pwfile = DATA_DIR.parent / "insights_iva_pg_pwfile"
        pwfile.write_text(APP_PASSWORD, encoding="utf-8")
        try:
            _run(
                [
                    str(PG_BIN / "initdb.exe"),
                    "-D",
                    str(DATA_DIR),
                    "-U",
                    APP_USER,
                    "-A",
                    "scram-sha-256",
                    "--pwfile",
                    str(pwfile),
                    "--no-locale",
                    "--encoding=UTF8",
                ]
            )
        finally:
            if pwfile.exists():
                pwfile.unlink()
        conf = DATA_DIR / "postgresql.conf"
        extra = (
            "\nlisten_addresses = '127.0.0.1'\n"
            f"port = {PORT}\n"
            "max_connections = 40\n"
            "shared_buffers = 32MB\n"
            "fsync = off\n"
            "synchronous_commit = off\n"
            "full_page_writes = off\n"
        )
        conf.write_text(conf.read_text(encoding="utf-8") + extra, encoding="utf-8")

    log_file = DATA_DIR / "pg_test.log"
    _run(
        [
            str(PG_BIN / "pg_ctl.exe"),
            "-D",
            str(DATA_DIR),
            "-l",
            str(log_file),
            "-o",
            f"-p {PORT} -c listen_addresses=127.0.0.1",
            "start",
        ]
    )
    for _ in range(30):
        if _pg_is_ready():
            break
        time.sleep(0.4)
    else:
        print("start_failed=not_ready")
        return 1

    env = os.environ.copy()
    env["PGPASSWORD"] = APP_PASSWORD
    createdb = subprocess.run(
        [
            str(PG_BIN / "createdb.exe"),
            "-h",
            "127.0.0.1",
            "-p",
            str(PORT),
            "-U",
            APP_USER,
            TEST_DB,
        ],
        capture_output=True,
        text=True,
        env=env,
    )
    if createdb.returncode != 0 and "already exists" not in (createdb.stderr or ""):
        print(f"createdb_error_type=CalledProcessError")
        return 1
    print(f"started port={PORT}")
    print(f"data_dir={DATA_DIR}")
    print(f"database={TEST_DB}")
    print("host=127.0.0.1")
    print(f"user={APP_USER}")
    return 0


def stop() -> int:
    if not DATA_DIR.exists():
        print("stopped=already_absent")
        return 0
    subprocess.run(
        [str(PG_BIN / "pg_ctl.exe"), "-D", str(DATA_DIR), "-m", "fast", "stop"],
        capture_output=True,
        text=True,
    )
    print("stopped=true")
    return 0


def destroy() -> int:
    stop()
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR, ignore_errors=True)
    print("destroyed=true")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "start"
    if cmd == "start":
        raise SystemExit(start())
    if cmd == "stop":
        raise SystemExit(stop())
    if cmd == "destroy":
        raise SystemExit(destroy())
    print("usage: start|stop|destroy")
    raise SystemExit(2)
