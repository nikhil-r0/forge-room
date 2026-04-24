from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..shared import repository
from ..shared.bootstrap import ensure_database, ensure_demo_repo
from ..shared.contracts import (
    AgentRequest,
    ChatBatchRequest,
    CreateRoomRequest,
    CreateRoomResponse,
    DriftCheckRequest,
    ExportResponse,
    RoomSnapshot,
    SkillRequest,
)
from ..shared.database import ENGINE, get_db
from ..shared.exporter import generate_markdown_export
from ..shared.repository import add_skill, create_room, get_room, snapshot_room
from ..shared.settings import get_settings
from .graph import ForgeRoomGraph
from .nodes.agents.appsec import run_appsec_review
from .nodes.drift_detector import run_drift_detection
from .nodes.risk_autopsy import generate_risk_autopsy
from .utils import fetch_skill_from_url


import logging

# Setup orchestrator logger FIRST
# We use a simple level check to avoid re-configuring if already done
logging.basicConfig(
    level=logging.INFO, # Will be elevated to DEBUG in get_settings check if needed
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("orchestrator")

settings = get_settings()
# Update level based on settings
if settings.debug_mode:
    logger.setLevel(logging.DEBUG)

graph = ForgeRoomGraph()
app = FastAPI(title="ForgeRoom Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_database(ENGINE)
    ensure_demo_repo(settings.target_repo)


@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room_endpoint(body: CreateRoomRequest, db: Session = Depends(get_db)) -> CreateRoomResponse:
    logger.info(f"🆕 Creating new room with goal: {body.current_goal[:50]}...")
    try:
        room = create_room(db, body.current_goal, body.focus_mode)
        logger.info(f"✅ Room created: {room.id}")
        return CreateRoomResponse(room_id=room.id)
    except Exception as e:
        logger.error(f"❌ Failed to create room: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error durante room creation")


@app.get("/api/rooms/{room_id}", response_model=RoomSnapshot)
async def get_room_endpoint(room_id: str, db: Session = Depends(get_db)) -> RoomSnapshot:
    logger.info(f"🔍 Fetching snapshot for Room: {room_id}")
    room = get_room(db, room_id)
    if room is None:
        logger.warning(f"🚫 Room not found: {room_id}")
        raise HTTPException(status_code=404, detail="Room not found")
    return snapshot_room(db, room_id)


@app.post("/api/process-batch")
async def process_batch(body: ChatBatchRequest, db: Session = Depends(get_db)):
    room = get_room(db, body.room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    try:
        logger.info(f"🚀 Starting Orchestrator Run for Room: {body.room_id} | Batch size: {len(body.messages)}")
        # Since ForgeRoomGraph.run manages its own nodes internally, 
        # we log the overall progress of the run.
        result = await graph.run(db, body.room_id)
        
        logger.info(f"✅ Orchestrator Run Completed. Goals: {result.get('current_goal')} | Decisions found: {len(result.get('approved_decisions', []))}")
        return result
    except Exception as e:
        logger.error(f"❌ Orchestrator CRASHED for Room {body.room_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Orchestrator error: {str(e)}")


@app.post("/api/rooms/{room_id}/agent")
async def agent_endpoint(room_id: str, body: AgentRequest, db: Session = Depends(get_db)):
    logger.info(f"🤖 Invoking agent '{body.agent_name}' for Room: {room_id}")
    if get_room(db, room_id) is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # 1. Check for specialized 'appsec' agent
    if body.agent_name.lower() == "appsec":
        try:
            result = await run_appsec_review(db, room_id, graph.provider)
            logger.info(f"✅ Agent '{body.agent_name}' response received.")
            return result
        except Exception as e:
            logger.error(f"❌ Agent execution failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    # 2. Check for dynamic skill-based agents
    skills = repository.list_skills(db, room_id)
    # Match exactly or by prefix (e.g., @React matching 'react-specialist')
    matching_skill = next(
        (s for s in skills if s.name.lower() == body.agent_name.lower() or s.name.lower().startswith(body.agent_name.lower())), 
        None
    )
    
    if matching_skill:
        try:
            decisions = repository.list_decisions(db, room_id)
            # Use general snapshot for dynamic skills
            from .utils import build_codebase_snapshot
            snapshot = build_codebase_snapshot(get_settings().target_repo)
            
            result = await graph.provider.invoke_skill_agent(
                agent_name=matching_skill.name,
                skill_content=matching_skill.content,
                approved_decisions=decisions,
                snapshot=snapshot
            )
            
            # Record the run
            repository.add_agent_run(db, room_id, result)
            return result
        except Exception as e:
            logger.error(f"❌ Skill Agent '{body.agent_name}' failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Skill Agent error: {str(e)}")

    raise HTTPException(status_code=400, detail=f"Agent or Skill '{body.agent_name}' not found.")


@app.post("/api/rooms/{room_id}/drift-check")
async def drift_check(room_id: str, body: DriftCheckRequest, db: Session = Depends(get_db)):
    if get_room(db, room_id) is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return await run_drift_detection(
        db=db,
        room_id=room_id,
        proposed_decision=body.proposed_decision,
        category=body.category.value,
        decision_id=None,
        provider=graph.provider,
    )


@app.post("/api/rooms/{room_id}/skills")
async def add_skill_endpoint(room_id: str, body: SkillRequest, db: Session = Depends(get_db)):
    logger.info(f"📚 Adding new skill to Room: {room_id} | Source: {body.source_url or 'direct upload'}")
    if get_room(db, room_id) is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    content = body.content
    if not content and body.source_url:
        try:
            content = await fetch_skill_from_url(body.source_url)
        except Exception as e:
            logger.error(f"❌ Failed to fetch skill from URL {body.source_url}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch skill from URL: {str(e)}")
    
    if not content:
        raise HTTPException(status_code=400, detail="Skill content is required (either direct or via source_url)")

    skill = add_skill(db, room_id, body.name, content, body.source_url)
    
    # Broadcast spec update to show new skill
    from ..websocket_gateway.publisher import make_message
    from ..shared.contracts import MessageType
    import httpx

    snapshot = snapshot_room(db, room_id)
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            await client.post(
                f"{settings.websocket_url}/api/rooms/{room_id}/broadcast",
                json=make_message(
                    MessageType.SPEC_UPDATE,
                    room_id,
                    "system:orchestrator",
                    {
                        "current_goal": snapshot.current_goal,
                        "approved_decisions": [d.model_dump(mode="json") for d in snapshot.approved_decisions],
                        "pending_tasks": snapshot.pending_tasks,
                        "open_conflicts": len(snapshot.pending_conflicts),
                        "active_skills": [s.model_dump(mode="json") for s in snapshot.active_skills],
                    }
                )
            )
    except Exception as e:
        logger.warning(f"⚠️ Failed to broadcast spec update after skill addition: {e}")

    return skill


@app.post("/api/rooms/{room_id}/export", response_model=ExportResponse)
async def export_session(room_id: str, db: Session = Depends(get_db)) -> ExportResponse:
    room = get_room(db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    snapshot = snapshot_room(db, room_id)
    risk_autopsy = await generate_risk_autopsy(db, room_id, graph.provider)
    markdown = generate_markdown_export(snapshot, risk_autopsy)
    from ..shared.repository import save_export

    save_export(db, room_id, markdown, risk_autopsy)
    return ExportResponse(room_id=room_id, markdown=markdown, risk_autopsy=risk_autopsy)


class ExecuteSyncRequest(BaseModel):
    summary: str


@app.post("/api/rooms/{room_id}/sync-execution")
async def sync_execution(room_id: str, body: ExecuteSyncRequest, db: Session = Depends(get_db)):
    """Sync execution result to orchestrator memory and DB."""
    from ..shared.repository import store_chat_messages
    from ..websocket_gateway.publisher import make_message
    from ..shared.contracts import MessageType
    import httpx

    summary = body.summary

    # 1. Store in DB
    msg_obj = {
        "sender": "@Implementer",
        "message": summary,
        "timestamp": datetime.now(UTC).isoformat()
    }
    store_chat_messages(db, room_id, [msg_obj])

    # 2. Broadcast via WS
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            await client.post(
                f"{settings.websocket_url}/api/rooms/{room_id}/broadcast",
                json=make_message(
                    MessageType.CHAT,
                    room_id,
                    "agent:@Implementer",
                    {"message": summary, "display_name": "Implementer (Gemini)"}
                )
            )
    except Exception as e:
        logger.warning(f"⚠️ Failed to broadcast implementation message: {e}")

    # 3. Process with Graph to update specimen
    logger.info(f"🔄 Syncing execution summary into specimens for Room: {room_id}")
    result = await graph.run(db, room_id)
    
    # 4. Broadcast spec update
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            await client.post(
                f"{settings.websocket_url}/api/rooms/{room_id}/broadcast",
                json=make_message(
                    MessageType.SPEC_UPDATE,
                    room_id,
                    "system:supervisor",
                    {
                        "current_goal": result["current_goal"],
                        "approved_decisions": result["approved_decisions"],
                        "pending_tasks": result["pending_tasks"],
                        "open_conflicts": len(result["pending_conflicts"]),
                    }
                )
            )
    except Exception as e:
        logger.warning(f"⚠️ Failed to broadcast spec update after sync: {e}")

    return {"status": "synced", "snapshot": result}
