from __future__ import annotations

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from ..shared.bootstrap import ensure_demo_repo
from ..shared.contracts import ExecuteSpecRequest, ExecuteSpecResponse
from ..shared.settings import get_settings
from ..shared.database import get_db
from ..shared.models import User
from ..shared.repository import get_room
from .gemini_cli import run_gemini_cli


import logging

# Setup Execution Bridge logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("execution_bridge")

settings = get_settings()
app = FastAPI(title="ForgeRoom Execution Bridge")
if "*" in settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
def startup() -> None:
    ensure_demo_repo(settings.target_repo)
    logger.info(f"🚀 Execution Bridge Started | Repo: {settings.target_repo}")

@app.post("/api/execute-spec", response_model=ExecuteSpecResponse)
async def execute_spec(body: ExecuteSpecRequest, db: Session = Depends(get_db)) -> ExecuteSpecResponse:
    user = db.get(User, body.executor_id)
    if not user or user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can execute specs.")

    room = get_room(db, body.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")

    target_repo = room.target_repo if room.target_repo else str(settings.target_repo)

    summary = await run_gemini_cli(
        spec=body.spec_markdown,
        decisions=[decision.model_dump(mode="json") for decision in body.approved_decisions],
        active_skills=[skill.model_dump(mode="json") for skill in body.active_skills],
        repo_path=target_repo,
        enable_fallbacks=settings.enable_demo_fallbacks,
        commit_message=body.commit_message,
        push=body.push,
    )

    # Sync back to Orchestrator
    sync_snapshot = None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=None) as client:
            sync_res = await client.post(
                f"{settings.orchestrator_url}/api/rooms/{body.room_id}/sync-execution",
                json={"summary": summary}
            )
            if sync_res.is_success:
                sync_snapshot = sync_res.json().get("snapshot")
    except Exception as e:
        logger.warning(f"⚠️ Failed to sync execution result to orchestrator: {e}")

    return ExecuteSpecResponse(summary=summary, status="success", snapshot=sync_snapshot)
