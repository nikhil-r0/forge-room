from __future__ import annotations

import json
from datetime import UTC, datetime

import httpx
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from ..shared.bootstrap import ensure_database
from ..shared.contracts import ChatBatchRequest, MessageType, VoteRequest
from ..shared.database import ENGINE, get_db
from ..shared.repository import cast_vote, get_room, store_chat_messages
from ..shared.settings import get_settings
from .connection_manager import ConnectionManager
from .debounce import DebounceBuffer
from .publisher import make_message


import logging

# Setup WebSocket Gateway logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("websocket_gateway")

settings = get_settings()
manager = ConnectionManager()
app = FastAPI(title="ForgeRoom WebSocket Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup() -> None:
    ensure_database(ENGINE)
    logger.info("🚀 WebSocket Gateway Started")

async def on_batch_ready(room_id: str, messages: list[dict]) -> None:
    try:
        logger.info(f"📤 Sending batch to Orchestrator for Room: {room_id}")
        async with httpx.AsyncClient(timeout=settings.service_timeout_seconds) as client:
            response = await client.post(
                f"{settings.orchestrator_url}/api/process-batch",
                json=ChatBatchRequest(room_id=room_id, messages=messages).model_dump(mode="json"),
            )
            response.raise_for_status()
            result = response.json()

        logger.info(f"📥 Received update from Orchestrator for Room: {room_id}")
        await manager.broadcast(
            room_id,
            make_message(
                MessageType.SPEC_UPDATE,
                room_id,
                "system:supervisor",
                {
                    "current_goal": result["current_goal"],
                    "approved_decisions": result["approved_decisions"],
                    "pending_tasks": result["pending_tasks"],
                    "open_conflicts": len(result["pending_conflicts"]),
                },
            ),
        )
        await manager.broadcast(
            room_id,
            make_message(
                MessageType.BLAME_GRAPH,
                room_id,
                "system:supervisor",
                {
                    "nodes": result["blame_graph_nodes"],
                    "edges": result["blame_graph_edges"],
                },
            ),
        )
        for conflict in result.get("pending_conflicts", []):
            await manager.broadcast(room_id, make_message(MessageType.CONFLICT, room_id, "system:supervisor", conflict))
        for alert in result.get("last_drift_alerts", []):
            await manager.broadcast(room_id, make_message(MessageType.DRIFT_ALERT, room_id, "system:supervisor", alert))
    except Exception as e:
        logger.error(f"❌ Error during batch processing for Room {room_id}: {str(e)}", exc_info=True)

debounce = DebounceBuffer(callback=on_batch_ready, debounce_seconds=settings.debounce_seconds)

@app.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str, db: Session = Depends(get_db)) -> None:
    client_ip = websocket.client.host if websocket.client else "unknown"
    
    if get_room(db, room_id) is None:
        logger.warning(f"🚫 Connection rejected: Room {room_id} not found | Client: {client_ip}")
        await websocket.accept()
        await websocket.send_text(json.dumps(make_message(MessageType.ERROR, room_id, "system:gateway", {"message": "Room not found"})))
        await websocket.close()
        return

    logger.info(f"🔌 Client connected: {user_id} in Room {room_id} | IP: {client_ip}")
    await manager.connect(websocket, room_id)
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw).get("payload", {})
            message = {
                "sender": user_id,
                "message": payload.get("message", ""),
                "timestamp": payload.get("timestamp"),
            }
            if not message["timestamp"]:
                message["timestamp"] = datetime.now(UTC).isoformat()
            
            logger.debug(f"💬 Msg from {user_id} in {room_id}: {message['message'][:50]}...")
            store_chat_messages(db, room_id, [message])
            await manager.broadcast(
                room_id,
                make_message(
                    MessageType.CHAT,
                    room_id,
                    f"user:{user_id}",
                    {"message": message["message"], "display_name": payload.get("display_name", user_id)},
                ),
            )
            await debounce.add_message(room_id, message)
    except WebSocketDisconnect:
        logger.info(f"🚪 Client disconnected: {user_id} in Room {room_id}")
        manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"💥 WebSocket crash for {user_id} in {room_id}: {str(e)}", exc_info=True)
        manager.disconnect(websocket, room_id)
    finally:
        pass


@app.post("/api/rooms/{room_id}/vote")
async def vote_endpoint(room_id: str, body: VoteRequest, db: Session = Depends(get_db)):
    room = get_room(db, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    conflict = cast_vote(db, body.conflict_id, body.user_id, body.vote)
    payload = conflict.model_dump(mode="json")
    await manager.broadcast(room_id, make_message(MessageType.VOTE_RESULT, room_id, "system:supervisor", payload))
    return payload
