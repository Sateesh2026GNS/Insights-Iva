"""Parse User-Agent into browser, OS, and device type."""

from __future__ import annotations

import re


def parse_user_agent(user_agent: str | None) -> dict[str, str]:
    ua = (user_agent or "").strip()
    if not ua:
        return {
            "browser": "Unknown",
            "operating_system": "Unknown",
            "device_type": "Desktop",
        }

    lower = ua.lower()
    device_type = "Desktop"
    if any(x in lower for x in ("mobile", "android", "iphone", "ipod", "webos")):
        device_type = "Mobile"
    elif "ipad" in lower or "tablet" in lower:
        device_type = "Tablet"

    if "windows nt" in lower:
        operating_system = "Windows"
    elif "android" in lower:
        operating_system = "Android"
    elif "iphone" in lower or "ipad" in lower or "ipod" in lower:
        operating_system = "iOS"
    elif "mac os x" in lower or "macintosh" in lower:
        operating_system = "macOS"
    elif "cros" in lower:
        operating_system = "Chrome OS"
    elif "linux" in lower:
        operating_system = "Linux"
    else:
        operating_system = "Unknown"

    browser = "Unknown"
    # Order matters — check Edge/Opera before Chrome.
    patterns = [
        (r"Edg(?:e|A|iOS)?/([\d.]+)", "Edge"),
        (r"OPR/([\d.]+)", "Opera"),
        (r"Firefox/([\d.]+)", "Firefox"),
        (r"CriOS/([\d.]+)", "Chrome"),
        (r"Chrome/([\d.]+)", "Chrome"),
        (r"Version/([\d.]+).*Safari", "Safari"),
        (r"Safari/([\d.]+)", "Safari"),
    ]
    for pattern, name in patterns:
        match = re.search(pattern, ua)
        if match:
            browser = f"{name} {match.group(1).split('.')[0]}"
            break

    return {
        "browser": browser,
        "operating_system": operating_system,
        "device_type": device_type,
        "device_name": f"{browser} on {operating_system}",
    }


def approximate_location_from_ip(ip_address: str | None) -> str | None:
    """Return a coarse location only when it can be derived reliably (no geo-IP guess)."""
    ip = (ip_address or "").strip().lower()
    if not ip:
        return None
    if ip in {"127.0.0.1", "::1", "localhost"}:
        return "Local network"
    if ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("172.16."):
        return "Local network"
    if ip.startswith("172."):
        try:
            second = int(ip.split(".")[1])
        except (IndexError, ValueError):
            return None
        if 16 <= second <= 31:
            return "Local network"
    return None
