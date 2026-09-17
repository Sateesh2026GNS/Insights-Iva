from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.reports import router as reports_router

v1_router = APIRouter(prefix="/v1")
v1_router.include_router(reports_router)
v1_router.include_router(agent_router)
