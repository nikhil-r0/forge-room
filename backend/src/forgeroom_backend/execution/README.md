# Execution Service Audit (`forgeroom_backend/execution`)

Scope: this README documents only the execution bridge code in:
- `backend/src/forgeroom_backend/execution`

It covers what each script does, inputs/outputs, side effects, and integration risks with frontend + other backend services.

## Service Summary

FastAPI app: `forgeroom_backend.execution.main:app` (default port `8001`)

Primary responsibilities:
- Generate a unified diff from living spec + approved decisions (`POST /api/execute-spec`)
- Validate and apply an approved diff to target repo, then commit (and optionally push) (`POST /api/apply-diff`)

## File-by-File Contracts

| File | What it does | Inputs | Outputs | Side effects / dependencies |
|---|---|---|---|---|
| `main.py` | API surface for execution bridge | `ExecuteSpecRequest`, `ApplyDiffRequest` | `ExecuteSpecResponse`, `ApplyDiffResponse` | Uses `settings.target_repo`; validates diff; commits git changes |
| `gemini_cli.py` | Calls local `gemini` CLI and extracts unified diff; falls back when missing/failing | `spec: str`, `decisions: list[dict]`, `repo_path: Path`, `enable_fallbacks: bool` | unified diff `str` or `RuntimeError` | subprocess call to local CLI; temporary prompt file |
| `fallbacks.py` | Deterministic fallback diff generator | `spec_markdown`, `approved_decisions` | valid unified diff creating `forgeroom_generated.md` | no external deps |
| `diff_utils.py` | Diff safety + format checks | `diff_text`, `repo_root` | `None` or `DiffValidationError` | prevents path traversal / unsafe targets |
| `git_ops.py` | Applies diff and creates commit; optional push | `diff_text`, `commit_message`, `repo_path`, `push` | `(commit_hash_8, "committed"|"pushed")` | `git apply`, stage all, commit, optional `origin.push()` |
| `__init__.py` | package marker | none | none | none |

## API Contracts

### `POST /api/execute-spec`

Request model (`ExecuteSpecRequest`):
- `spec_markdown: str`
- `approved_decisions: list[DecisionPayload]`

Response model (`ExecuteSpecResponse`):
- `diff: str`
- `status: "success"`

Flow:
1. `run_gemini_cli()` generates diff.
2. `validate_diff()` checks format/safety.
3. Returns diff if valid; otherwise `400`.

Errors:
- `400` when diff invalid (`DiffValidationError`)
- uncaught runtime errors in `run_gemini_cli` become FastAPI 500s

### `POST /api/apply-diff`

Request model (`ApplyDiffRequest`):
- `diff_text: str`
- `commit_message: str`
- `push: bool = false`

Response model (`ApplyDiffResponse`):
- `status: "committed" | "pushed"`
- `commit_hash: str | null`
- `detail: str | null` (currently not set in success response)

Flow:
1. Validate diff.
2. Apply patch via `git apply`.
3. Stage all (`git add -A`) and commit.
4. Push only when request `push=true` **and** `FORGEROOM_ALLOW_GIT_PUSH=true`.

Errors:
- `400` for invalid diff
- `500` for patch/apply/commit/push failures

## Integration Check

### Frontend -> Execution

Used by:
- `frontend/src/lib/api.ts`: `executeSpec()` and `applyDiff()`
- `frontend/src/components/modals/DiffModal.tsx`: approves edited diff
- `frontend/src/app/room/[id]/page.tsx`: generates spec markdown and calls `executeSpec()`

Status:
- Route paths match exactly (`/api/execute-spec`, `/api/apply-diff`).
- Payload shape matches backend Pydantic contracts.
- Frontend shows backend error text from API wrapper; good for debugging.

### Orchestrator/WebSocket -> Execution

Current architecture:
- Orchestrator and gateway do not call execution service directly.
- Execution service is invoked by frontend after living spec state is updated.

Operational dependency:
- All services must agree on `FORGEROOM_TARGET_REPO_PATH` to avoid drift between reviewed state and executed repo.

## Key Risks / Gaps

1. Prompt quality gap (medium)
- `gemini_cli._build_prompt()` computes `snapshot = _read_codebase(repo_path)` but never includes snapshot in prompt text.
- Effect: model has less repository context than intended, producing weaker diffs.

2. Async endpoint uses blocking subprocess (medium)
- `run_gemini_cli()` and `apply_diff_and_commit()` call blocking `subprocess.run()` inside async routes.
- Under load, this can reduce concurrency and increase latency.

3. Commit message can be blank (low)
- `commit_message.strip()` can become empty; commit title becomes `"[ForgeRoom] "`.
- Not a crash, but poor auditability.

4. Push failure handling (medium)
- `origin.push()` exceptions bubble as 500 without structured classification (auth vs remote missing vs network).

5. Diff safety checks are good but minimal (low)
- Validation checks path safety + hunks + unified header.
- Does not enforce file allowlist or limit patch size/file count.

## Test Coverage Status

Relevant test:
- `backend/tests/test_execution_bridge.py`

Latest run:
- Command: `/home/loki/projects/forge-room/backend/.venv/bin/pytest -q backend/tests/test_execution_bridge.py`
- Result: `1 passed`

What is already verified:
- fallback diff generation path
- diff validation
- patch apply + commit path

What still needs explicit integration tests:
- FastAPI route-level tests for 400/500 responses
- `push=true` with `FORGEROOM_ALLOW_GIT_PUSH` on/off
- malformed diff inputs from frontend editor
- large diff payload timeout behavior

## QA Checklist For You (Execution Owner)

1. Happy path
- Generate diff from room state and apply it; verify commit exists and files changed as expected.

2. Safety path
- Submit diff with outside-repo path (`+++ b/../../../etc/passwd`) and verify 400.

3. Fallback path
- Run without `gemini` CLI and verify fallback diff behavior is acceptable for demo.

4. Push guard
- Verify `push=true` is ignored when `FORGEROOM_ALLOW_GIT_PUSH=false`.

5. Regression path
- Edit diff in frontend modal (invalid hunk) and verify clear error feedback from `apply-diff`.
