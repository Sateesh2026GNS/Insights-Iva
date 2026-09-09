"""Antivirus scanning abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ScanResult:
    status: str  # SAFE | QUARANTINED | REJECTED | PENDING_SCAN | SCANNING
    message: str | None = None
    scanner_name: str = "unknown"
    is_configured: bool = False


class AntivirusScanner(ABC):
    name: str
    is_configured: bool = False

    @abstractmethod
    def scan_object(self, storage_key: str, storage_provider: str) -> ScanResult: ...
