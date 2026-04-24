from __future__ import annotations

from forgeroom_backend.shared import repository
from forgeroom_backend.shared.contracts import VoteChoice


def test_vote_resolution_and_snapshot(temp_db_and_repo):
    db, _repo_path = temp_db_and_repo
    room = repository.create_room(db, "Realtime design", False)
    conflict = repository.add_conflict(db, room.id, "Choose auth strategy", "JWT", "OAuth", "Auth discussion")

    repository.cast_vote(db, conflict.id, "alice", VoteChoice.A)
    resolved = repository.cast_vote(db, conflict.id, "bob", VoteChoice.A)

    assert resolved.resolved is True
    assert resolved.winner == VoteChoice.A

    snapshot = repository.snapshot_room(db, room.id)
    assert snapshot.pending_conflicts[0].resolved is True
