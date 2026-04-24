from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable


class DebounceBuffer:
    def __init__(self, callback: Callable[[str, list[dict]], Awaitable[None]], debounce_seconds: int = 4) -> None:
        self.callback = callback
        self.debounce_seconds = debounce_seconds
        self.buffers: dict[str, list[dict]] = defaultdict(list)
        self.timers: dict[str, asyncio.Task] = {}

    async def add_message(self, room_id: str, message: dict) -> None:
        self.buffers[room_id].append(message)
        timer = self.timers.get(room_id)
        if timer and not timer.done():
            timer.cancel()
        self.timers[room_id] = asyncio.create_task(self._fire_after_delay(room_id))

    async def _fire_after_delay(self, room_id: str) -> None:
        await asyncio.sleep(self.debounce_seconds)
        messages = self.buffers.get(room_id, [])
        if not messages:
            return
        self.buffers[room_id] = []
        await self.callback(room_id, messages)
