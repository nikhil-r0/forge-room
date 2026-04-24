# ForgeRoom Backend Package (`forgeroom_backend`)

This README documents every script under `backend/src/forgeroom_backend`, including what each file does, its input/output contracts, and integration risks with the frontend and sibling backend services.

## 1) Runtime Topology

- Orchestrator service: `forgeroom_backend.orchestrator.main:app` on `:8000`
- Execution bridge: `forgeroom_backend.execution.main:app` on `:8001`
- WebSocket gateway: `forgeroom_backend.websocket_gateway.main:app` on `:8002`
- Shared DB/models/contracts used by all services: `forgeroom_backend.shared.*`

Startup dependencies:
- `shared.bootstrap.ensure_database()` creates tables.
- `shared.bootstrap.ensure_demo_repo()` seeds `FORGEROOM_TARGET_REPO_PATH` and initializes git repo when missing.

## 2) API + WS Contracts (Current Implementation)

REST endpoints:
- `POST /api/rooms` (orchestrator): input `CreateRoomRequest`, output `CreateRoomResponse`
- `GET /api/rooms/{room_id}` (orchestrator): output `RoomSnapshot`
- `POST /api/process-batch` (orchestrator): input `ChatBatchRequest`, output room state dict
- `POST /api/rooms/{room_id}/agent` (orchestrator): input `AgentRequest`, output `AgentPayload`
- `POST /api/rooms/{room_id}/drift-check` (orchestrator): input `DriftCheckRequest`, output drift result dict
- `POST /api/rooms/{room_id}/skills` (orchestrator): input `SkillRequest`, output `SkillPayload`
- `GET /api/rooms/{room_id}/export` (orchestrator): output `ExportResponse`
- `POST /api/execute-spec` (execution): input `ExecuteSpecRequest`, output `ExecuteSpecResponse`
- `POST /api/apply-diff` (execution): input `ApplyDiffRequest`, output `ApplyDiffResponse`
- `POST /api/rooms/{room_id}/vote` (websocket gateway): input `VoteRequest`, output `ConflictPayload`

WebSocket:
- `ws://<host>:8002/ws/{room_id}/{user_id}`
- Message envelope created by `websocket_gateway.publisher.make_message()`:
  - `type`, `room_id`, `sender_id`, `timestamp`, `payload`
- Broadcast types currently used:
  - `chat`, `spec_update`, `blame_graph`, `conflict`, `drift_alert`, `vote_result`, `error`

## 3) Script-by-Script Documentation

### Package roots

| File | What it does | Inputs | Outputs / Side effects |
|---|---|---|---|
| `__init__.py` | Package marker for backend module | None | No runtime side effects |
| `orchestrator/__init__.py` | Package marker | None | None |
| `orchestrator/nodes/__init__.py` | Package marker | None | None |
| `orchestrator/nodes/agents/__init__.py` | Package marker | None | None |
| `execution/__init__.py` | Package marker | None | None |
| `websocket_gateway/__init__.py` | Package marker | None | None |
| `shared/__init__.py` | Package marker | None | None |

### `shared/`

| File | What it does | Inputs | Outputs / Side effects |
|---|---|---|---|
| `shared/contracts.py` | Central Pydantic contracts and enums used across services and frontend | JSON payloads from API/WS callers | Typed validation objects (`RoomSnapshot`, `DecisionPayload`, etc.); validation errors on bad input |
| `shared/models.py` | SQLAlchemy ORM models for `rooms`, `chat_messages`, `decisions`, `conflicts`, `votes`, `drift_alerts`, `agent_runs`, `exports` | DB session usage by repository layer | DB schema definitions; defaults/timestamps |
| `shared/database.py` | DB engine/session factory and dependency generator (`get_db`) | `FORGEROOM_DATABASE_URL` or override via `configure_database()` | SQLAlchemy engine/session lifecycle |
| `shared/settings.py` | App settings loading from env + `.env` fallback lookup | `FORGEROOM_*` environment variables | `Settings` singleton (`get_settings()`); prints config source at runtime |
| `shared/demo_repo.py` | Seeds local demo repository files under target repo path | `repo_root: Path` | Creates files only if missing |
| `shared/bootstrap.py` | Bootstraps DB tables and demo repo git initialization | SQLAlchemy engine, target repo path | Creates tables, seeds files, initializes git repo + initial commit |
| `shared/blame.py` | Builds blame graph nodes/edges from decision list | `decisions`, optional new decision IDs | `list[BlameNode]`, `list[BlameEdge]` |
| `shared/exporter.py` | Builds markdown session artifact from snapshot + risk autopsy | `RoomSnapshot`, `risk_autopsy` markdown | Export markdown string |
| `shared/repository.py` | All DB read/write operations and snapshot serialization | SQLAlchemy `Session`, room/conflict/decision identifiers, payload fields | Persistent DB mutations and typed room snapshots |

`shared/repository.py` key I/O:
- `create_room(current_goal, focus_mode) -> Room`
- `store_chat_messages(messages=[{sender,message,timestamp}]) -> commit`
- `add_decision(description, category, depends_on, risk_score=0.0) -> Decision`
- `add_conflict(summary, option_a, option_b, context) -> Conflict`
- `cast_vote(conflict_id, user_id, choice) -> ConflictPayload` (also resolves winner)
- `add_drift_alert(...) -> DriftAlert`
- `add_skill(name, content, source_url?) -> Skill`
- `list_skills(room_id) -> list[SkillPayload]`
- `snapshot_room(room_id, new_decision_ids?) -> RoomSnapshot` (includes `active_skills`)

### `orchestrator/`

| File | What it does | Inputs | Outputs / Side effects |
|---|---|---|---|
| `orchestrator/main.py` | FastAPI app for room lifecycle, orchestration trigger, agent invocation, drift check, export | REST requests | Returns snapshots/reports; writes DB; ensures DB + demo repo on startup |
| `orchestrator/graph.py` | Coordinates supervisor + drift detection pipeline | `db`, `room_id` | State dict including updated blame graph and drift alerts |
| `orchestrator/state.py` | TypedDict state shape for orchestration pipeline | Internal state maps | Type hints only |
| `orchestrator/prompts.py` | Prompt templates for supervisor, drift, risk autopsy, AppSec | Chat history / code snapshots / decisions | Prompt strings |
| `orchestrator/providers.py` | AI provider abstraction + fallback heuristics when Gemini unavailable | Chat history, decisions, code snapshot text | Parsed structured outputs for supervisor, drift, risk report, appsec |
| `orchestrator/utils.py` | Codebase snapshot builders and Skill URL fetcher (GitHub raw normalization) | `repo_path`, category, URL | Snapshot text or skill markdown content |
| `orchestrator/nodes/supervisor.py` | Applies supervisor result to DB: goal, decisions, tasks, conflicts | `db`, `room_id`, `AIProvider` | Updated state dict + pending drift checks |
| `orchestrator/nodes/drift_detector.py` | Runs drift detection and stores drift alerts/contradictions | decision text/category + snapshot via provider | Drift result dict; writes drift alerts |
| `orchestrator/nodes/risk_autopsy.py` | Generates risk report from decisions/conflicts/drift stats | `db`, `room_id`, `AIProvider` | Markdown report string |
| `orchestrator/nodes/agents/appsec.py` | Runs AppSec agent review and stores run history | `db`, `room_id`, `AIProvider` | `AgentPayload`; writes `agent_runs` |

### `execution/`

| File | What it does | Inputs | Outputs / Side effects |
|---|---|---|---|
| `execution/main.py` | FastAPI app for diff generation and diff apply/commit | `ExecuteSpecRequest`, `ApplyDiffRequest` | Diff text, commit hash/status; validates diff safety |
| `execution/gemini_cli.py` | Runs Gemini CLI via subprocess and extracts unified diff, with fallback | spec markdown, approved decisions, repo path | Unified diff string or RuntimeError |
| `execution/fallbacks.py` | Deterministic fallback diff generator if Gemini CLI unavailable | spec markdown + decisions | Valid unified diff that creates `forgeroom_generated.md` |
| `execution/diff_utils.py` | Diff validation and path safety checks | unified diff string + repo root path | Raises `DiffValidationError` or returns success |
| `execution/git_ops.py` | Applies patch, stages all, commits, optional push | diff text, commit message, repo path, push flag | `(short_commit_hash, detail)`; mutates git repo |

### `websocket_gateway/`

| File | What it does | Inputs | Outputs / Side effects |
|---|---|---|---|
| `websocket_gateway/main.py` | WebSocket + vote API; persists chat; debounces and forwards batch to orchestrator; broadcasts results | WS chat envelope and vote payload | DB writes + room broadcasts of chat/spec/conflict/drift/vote events |
| `websocket_gateway/connection_manager.py` | Connection tracking by room and room-level broadcast | websocket instances + room IDs | Active connection map mutation |
| `websocket_gateway/debounce.py` | Async room-level debounce queue for batched processing | room_id + message dict | Delayed callback execution |
| `websocket_gateway/publisher.py` | Normalizes outgoing WS envelopes | message type + room/sender/payload | Standard message dict |

## 4) Integration Verification (Frontend + Other Services)

Cross-checked against:
- `frontend/src/lib/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/websocket.ts`
- `frontend/src/lib/useRoomStore.ts`
- room page and modal components

### Working contracts
- Frontend type contracts match backend Pydantic models for room snapshot, conflict payloads, drift alerts, and export response.
- REST paths used in frontend API client match current backend routes.
- WS envelope shape (`type`, `room_id`, `sender_id`, `timestamp`, `payload`) matches frontend router logic.
- Debounce behavior (batch to orchestrator, then broadcast derived state) aligns with architecture PDFs and test expectations.

### Integration risks to track

1. `@agent` UX gap (high)
- Frontend sends `invokeAgent()` via REST but does not append returned payload to chat.
- Backend does not broadcast `agent_response` over WS after agent call.
- Result: tagged agent call can succeed but appear silent in live chat.

2. WS env var mismatch (medium)
- `frontend/src/lib/api.ts` uses `NEXT_PUBLIC_WS_GATEWAY_URL`.
- `frontend/src/lib/websocket.ts` uses `NEXT_PUBLIC_WS_URL`.
- Misconfigured deployment can make vote API and WS socket point to different hosts.

3. Vote conflict validation gap (high)
- `cast_vote()` assumes `conflict_id` exists; missing/invalid IDs can throw server-side errors.
- `vote_endpoint` does not validate `conflict_id` belongs to URL `room_id`.

4. Debounce callback error handling (medium)
- `on_batch_ready()` raises on orchestrator failure (`raise_for_status()`), and debounce task exceptions are not surfaced to clients as structured WS errors.

5. Prompt/codebase mismatch in execution bridge (medium)
- `execution/gemini_cli._build_prompt()` computes codebase snapshot but does not include it in the actual prompt text.
- Impact: weaker code-gen quality than intended architecture.

6. Documentation drift (low)
- Root `README.md` points to a different absolute path (`/home/loki/projects/athernex/...`), inconsistent with this repo location.

## 5) Frontend Integration Guide (Skills)

To integrate the Skill feature with your frontend, follow these steps:

### A. Update Types
Add `SkillPayload` and update `RoomSnapshot` in `frontend/src/lib/types.ts`.

```typescript
export interface SkillPayload {
  id: number;
  name: string;
  content: string;
  source_url?: string;
  created_at: string;
}

export interface RoomSnapshot {
  // ... existing fields
  active_skills: SkillPayload[];
}
```

### B. Add API Methods
In `frontend/src/lib/api.ts`, add the skill creation method.

```typescript
export async function addSkill(roomId: string, name: string, content?: string, sourceUrl?: string) {
  const response = await fetch(`${ORCHESTRATOR_URL}/api/rooms/${roomId}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content, source_url: sourceUrl }),
  });
  return response.json();
}
```

### C. Sync State
Update `useRoomStore.ts` to include `activeSkills` and handle `SPEC_UPDATE` broadcasts.

```typescript
// Initial state
activeSkills: [],

// In updateFromSnapshot
activeSkills: snapshot.active_skills || [],

// In SPEC_UPDATE handler
if (payload.active_skills) {
  set({ activeSkills: payload.active_skills });
}
```

### D. Update Execution Call
When triggering the Execution Bridge (`/api/execute-spec`), ensure you pass the `active_skills`.

```typescript
await executeSpec({
  room_id: roomId,
  spec_markdown: currentSpec,
  approved_decisions: approvedDecisions,
  active_skills: activeSkills, // Crucial for Implementer guidance
});
```

## 6) Test Status (Current Local Run)

Executed on `2026-04-24`:

- Command: `/home/loki/projects/forge-room/backend/.venv/bin/pytest -q`
- Result: `43 passed in 0.75s`

Notes:
- Running `pytest` with system interpreter failed initially due missing deps (`gitpython`), resolved by creating `.venv` and installing project extras.

## 6) Practical QA Checklist For Your Role

1. API/WS contract QA
- Create room, fetch snapshot, open WS, send chat, confirm `spec_update` + `blame_graph` arrive after debounce.
- Trigger conflict, vote from two clients, verify resolve semantics and `vote_result` fanout.

2. Execution QA
- Call `execute-spec`, verify diff passes `validate_diff`.
- Approve via `apply-diff`, verify commit hash and file mutation in target repo.

3. Export QA
- Call export endpoint after decisions/conflicts/drift exist.
- Validate markdown contains decisions, tasks, conflicts, drift, and risk autopsy sections.

4. Failure-mode QA
- Orchestrator down: observe gateway behavior and client error handling.
- Invalid conflict id vote: confirm expected HTTP behavior (currently needs hardening).
- Gemini CLI absent + fallbacks off: verify proper 500 detail propagation.
