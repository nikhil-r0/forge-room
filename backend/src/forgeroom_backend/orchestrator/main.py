from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from ..shared.bootstrap import ensure_database, ensure_demo_repo
from ..shared.contracts import (
    AgentRequest,
    ChatBatchRequest,
    CreateRoomRequest,
    CreateRoomResponse,
    DriftCheckRequest,
    ExportResponse,
    RoomSnapshot,
)
from ..shared.database import ENGINE, get_db
from ..shared.exporter import generate_markdown_export
from ..shared.repository import create_room, get_room, snapshot_room
from ..shared.settings import get_settings
from .graph import ForgeRoomGraph
from .nodes.agents.appsec import run_appsec_review
from .nodes.drift_detector import run_drift_detection
from .nodes.risk_autopsy import generate_risk_autopsy


settings = get_settings()
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
    room = create_room(db, body.current_goal, body.focus_mode)
    return CreateRoomResponse(room_id=room.id)


@app.get("/api/rooms/{room_id}", response_model=RoomSnapshot)
async def get_room_endpoint(room_id: str, db: Session = Depends(get_db)) -> RoomSnapshot:
    room = get_room(db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return snapshot_room(db, room_id)


@app.post("/api/process-batch")
async def process_batch(body: ChatBatchRequest, db: Session = Depends(get_db)):
    room = get_room(db, body.room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return await graph.run(db, body.room_id)


@app.post("/api/rooms/{room_id}/agent")
async def agent_endpoint(room_id: str, body: AgentRequest, db: Session = Depends(get_db)):
    if get_room(db, room_id) is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if body.agent_name.lower() != "appsec":
        raise HTTPException(status_code=400, detail="Unsupported agent")
    return await run_appsec_review(db, room_id, graph.provider)


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


@app.get("/api/rooms/{room_id}/export", response_model=ExportResponse)
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
