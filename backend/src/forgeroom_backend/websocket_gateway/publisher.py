from __future__ import annotations

import uuid
from datetime import UTC, datetime

from ..shared.contracts import MessageType


def make_message(message_type: MessageType | str, room_id: str, sender_id: str, payload: dict) -> dict:
    return {
        "id": uuid.uuid4().hex,
        "type": message_type.value if hasattr(message_type, "value") else message_type,
        "room_id": room_id,
        "sender_id": sender_id,
        "timestamp": datetime.now(UTC).isoformat(),
        "payload": payload,
    }
