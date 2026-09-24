"""Future-ready provider status for voice/avatar/video generation (no fabricated output)."""

from __future__ import annotations

from app.core.config import get_settings


def training_video_provider_status() -> dict[str, str]:
    """Report whether a real video-generation integration is configured."""
    settings = get_settings()
    provider = (getattr(settings, "training_video_provider", None) or "").strip().lower()
    if provider in {"", "none", "disabled"}:
        return {
            "status": "not_configured",
            "message": "Video generation provider is not configured for this environment.",
        }
    return {"status": "configured", "provider": provider}


def voice_avatar_provider_status() -> dict[str, str]:
    provider = (getattr(settings, "voice_avatar_provider", None) or "").strip().lower()
    if provider in {"", "none", "disabled"}:
        return {
            "status": "not_configured",
            "message": "Voice/avatar generation provider is not configured.",
        }
    return {"status": "configured", "provider": provider}


def job_search_provider_status() -> dict[str, str]:
    settings = get_settings()
    provider = (getattr(settings, "job_search_provider", None) or "").strip().lower()
    if provider in {"", "none", "disabled"}:
        return {
            "status": "not_configured",
            "message": "External job search is not configured. No live job listings are available.",
        }
    return {"status": "configured", "provider": provider}
