"""Aggregate model imports.

Importing this package registers every ORM model on ``Base.metadata`` so that
``create_all`` and Alembic both see the complete schema.

Use ``import app.models.<module>`` (not ``from app.models import <module>``)
to avoid circular imports when a submodule is loaded via ``app.models.user``.
"""

from app.models.base import Base  # noqa: F401

import app.models.accounts  # noqa: F401
import app.models.ai_conversation  # noqa: F401
import app.models.alert  # noqa: F401
import app.models.bom  # noqa: F401
import app.models.business_documents  # noqa: F401
import app.models.company_settings  # noqa: F401
import app.models.department  # noqa: F401
import app.models.dispatch_address  # noqa: F401
import app.models.document  # noqa: F401
import app.models.erp_notification  # noqa: F401
import app.models.hr  # noqa: F401
import app.models.inventory  # noqa: F401
import app.models.manufacturing_workflow  # noqa: F401
import app.models.machine  # noqa: F401
import app.models.maintenance  # noqa: F401
import app.models.meeting  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.permission  # noqa: F401
import app.models.platform  # noqa: F401
import app.models.procurement  # noqa: F401
import app.models.product  # noqa: F401
import app.models.production  # noqa: F401
import app.models.quality  # noqa: F401
import app.models.role  # noqa: F401
import app.models.sales  # noqa: F401
import app.models.security  # noqa: F401
import app.models.task  # noqa: F401
import app.models.tenant  # noqa: F401
import app.models.user  # noqa: F401
