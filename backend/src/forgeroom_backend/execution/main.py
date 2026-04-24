from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ..shared.bootstrap import ensure_demo_repo
from ..shared.contracts import ApplyDiffRequest, ApplyDiffResponse, ExecuteSpecRequest, ExecuteSpecResponse
from ..shared.settings import get_settings
from .diff_utils import DiffValidationError, validate_diff
from .gemini_cli import run_gemini_cli
from .git_ops import apply_diff_and_commit


settings = get_settings()
app = FastAPI(title="ForgeRoom Execution Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_demo_repo(settings.target_repo)


@app.post("/api/execute-spec", response_model=ExecuteSpecResponse)
async def execute_spec(body: ExecuteSpecRequest) -> ExecuteSpecResponse:
    diff = await run_gemini_cli(
        spec=body.spec_markdown,
        decisions=[decision.model_dump(mode="json") for decision in body.approved_decisions],
        repo_path=settings.target_repo,
        enable_fallbacks=settings.enable_demo_fallbacks,
    )
    try:
        validate_diff(diff, settings.target_repo)
    except DiffValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ExecuteSpecResponse(diff=diff, status="success")


@app.post("/api/apply-diff", response_model=ApplyDiffResponse)
async def apply_diff(body: ApplyDiffRequest) -> ApplyDiffResponse:
    try:
        validate_diff(body.diff_text, settings.target_repo)
        commit_hash, detail = await apply_diff_and_commit(
            diff_text=body.diff_text,
            commit_message=body.commit_message,
            repo_path=settings.target_repo,
            push=body.push and settings.allow_git_push,
        )
    except DiffValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ApplyDiffResponse(status=detail, commit_hash=commit_hash)
