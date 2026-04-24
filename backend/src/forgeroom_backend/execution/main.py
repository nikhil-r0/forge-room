from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..shared.bootstrap import ensure_demo_repo
from ..shared.contracts import ExecuteSpecRequest, ExecuteSpecResponse
from ..shared.settings import get_settings
from .gemini_cli import run_gemini_cli


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
    summary = await run_gemini_cli(
        spec=body.spec_markdown,
        decisions=[decision.model_dump(mode="json") for decision in body.approved_decisions],
        repo_path=settings.target_repo,
        enable_fallbacks=settings.enable_demo_fallbacks,
        commit_message=body.commit_message,
        push=body.push,
    )
    return ExecuteSpecResponse(summary=summary, status="success")
