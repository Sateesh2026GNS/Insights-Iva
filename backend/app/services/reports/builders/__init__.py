def load_builders() -> None:
    """Import builder modules so @register_report runs."""
    from app.services.reports.builders import control, inward, outward, stock  # noqa: F401
