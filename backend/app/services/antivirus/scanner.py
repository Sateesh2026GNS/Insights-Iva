"""Antivirus scanner factory — never falsely marks files SAFE when not configured."""

from functools import lru_cache

from app.core.config import get_settings
from app.services.antivirus.base import AntivirusScanner, ScanResult
from app.services.storage.factory import get_storage_provider


class NoOpAntivirusScanner(AntivirusScanner):
    """When antivirus is disabled — files remain PENDING_SCAN until manually approved in dev."""

    name = "disabled"
    is_configured = False

    def scan_object(self, storage_key: str, storage_provider: str) -> ScanResult:
        return ScanResult(
            status="PENDING_SCAN",
            message="Antivirus scanning is not configured. File is not available for download.",
            scanner_name=self.name,
            is_configured=False,
        )


class ClamAVScanner(AntivirusScanner):
    name = "clamav"
    is_configured = True

    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port

    def scan_object(self, storage_key: str, storage_provider: str) -> ScanResult:
        try:
            import clamd  # type: ignore
        except ImportError:
            return ScanResult(
                status="PENDING_SCAN",
                message="ClamAV client (clamd) not installed.",
                scanner_name=self.name,
                is_configured=False,
            )

        provider = get_storage_provider()
        if storage_provider == "local" and hasattr(provider, "read_bytes"):
            data = provider.read_bytes(storage_key)
        else:
            return ScanResult(
                status="PENDING_SCAN",
                message="ClamAV scan requires local storage or a scan worker with object access.",
                scanner_name=self.name,
                is_configured=True,
            )

        try:
            cd = clamd.ClamdNetworkSocket(self.host, self.port)
            result = cd.instream(data)
            status, sig = result.get("stream", ("OK", None))
            if status == "OK":
                return ScanResult(status="SAFE", scanner_name=self.name, is_configured=True)
            return ScanResult(
                status="QUARANTINED",
                message=sig or "Threat detected",
                scanner_name=self.name,
                is_configured=True,
            )
        except Exception as exc:
            return ScanResult(
                status="PENDING_SCAN",
                message=f"Scan failed: {exc}",
                scanner_name=self.name,
                is_configured=True,
            )


@lru_cache
def get_antivirus_scanner() -> AntivirusScanner:
    settings = get_settings()
    if not settings.antivirus_enabled:
        return NoOpAntivirusScanner()
    if settings.antivirus_provider == "clamav" and settings.clamav_host:
        return ClamAVScanner(settings.clamav_host, settings.clamav_port)
    return NoOpAntivirusScanner()
