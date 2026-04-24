from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .fallbacks import build_fallback_summary


async def run_gemini_cli(
    spec: str,
    decisions: list[dict],
    repo_path: Path,
    enable_fallbacks: bool = True,
    commit_message: str | None = None,
    push: bool = False,
) -> str:
    prompt = _build_prompt(spec, decisions, repo_path, commit_message, push)
    executable = shutil.which("gemini")
    if not executable:
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError("Gemini CLI is not installed.")

    try:
        # We pass the prompt via stdin. stdin=subprocess.PIPE + input=prompt 
        # handles writing the input and closing stdin.
        result = subprocess.run(
            [executable],
            cwd=repo_path,
            input=prompt,
            capture_output=True,
            text=True,
            # Removed timeout=120 as requested.
        )
    except Exception as exc:
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError(f"Gemini CLI failed: {exc}")

    if result.returncode != 0:
        # If it failed, we return stderr if available, or fallback
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError(result.stderr.strip() or "Gemini CLI failed.")

    # Return the full output as a summary of what it did.
    return result.stdout.strip()


def _build_prompt(
    spec: str,
    decisions: list[dict],
    repo_path: Path,
    commit_message: str | None = None,
    push: bool = False,
) -> str:
    snapshot = _read_codebase(repo_path)
    decisions_text = "\n".join(f"- {decision['description']}" for decision in decisions)
    
    task_ext = ""
    if commit_message:
        task_ext += f"\nAfter implementing, commit the changes with message: {commit_message}"
    if push:
        task_ext += "\nAlso, push the changes to the remote repository."

    return f"""You are a senior software engineer implementing an approved architecture specification.

APPROVED DECISIONS:
{decisions_text}

LIVING SPEC:
{spec}

TASK:
Implement the approved decisions in the codebase.{task_ext}
Provide a complete summary of the changes you made and the logic behind them.
"""


def _read_codebase(repo_path: Path) -> str:
    ignore_dirs = {".git", "node_modules", "__pycache__", ".next", ".venv", "venv"}
    suffixes = {".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".yaml", ".yml"}
    content = []
    for file_path in sorted(repo_path.rglob("*")):
        if not file_path.is_file() or file_path.suffix not in suffixes:
            continue
        if any(part in ignore_dirs for part in file_path.parts):
            continue
        try:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        content.append(f"### FILE: {file_path.relative_to(repo_path)}\n{text}")
    return "\n\n".join(content)
