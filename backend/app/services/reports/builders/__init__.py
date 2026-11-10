def load_builders() -> None:
    """Import builder modules so @register_report runs."""
    from app.services.reports.builders import (  # noqa: F401
        catalog_extended,
        control,
        inward,
        outward,
        stock,
    )
