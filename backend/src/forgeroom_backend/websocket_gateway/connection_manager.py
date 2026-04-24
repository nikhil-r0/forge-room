from __future__ import annotations

import json
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, room_id: str) -> None:
        await websocket.accept()
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        if room_id not in self.active_connections:
            return
        self.active_connections[room_id] = [connection for connection in self.active_connections[room_id] if connection != websocket]
        if not self.active_connections[room_id]:
            self.active_connections.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict) -> None:
        dead = []
        for connection in self.active_connections.get(room_id, []):
            try:
                await connection.send_text(json.dumps(message, default=str))
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(connection, room_id)
