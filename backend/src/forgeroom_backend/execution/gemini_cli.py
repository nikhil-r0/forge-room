from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from .fallbacks import build_fallback_diff


async def run_gemini_cli(spec: str, decisions: list[dict], repo_path: Path, enable_fallbacks: bool = True) -> str:
    prompt = _build_prompt(spec, decisions, repo_path)
    executable = shutil.which("gemini")
    if not executable:
        if enable_fallbacks:
            return build_fallback_diff(spec, decisions)
        raise RuntimeError("Gemini CLI is not installed.")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as handle:
        handle.write(prompt)
        prompt_file = handle.name

    try:
        result = subprocess.run(
            [executable, "-p", prompt_file],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=120,
        )
    finally:
        Path(prompt_file).unlink(missing_ok=True)

    if result.returncode != 0:
        if enable_fallbacks:
            return build_fallback_diff(spec, decisions)
        raise RuntimeError(result.stderr.strip() or "Gemini CLI failed.")

    output = result.stdout.strip()
    if output.startswith("--- "):
        return output + ("\n" if not output.endswith("\n") else "")

    extracted = _extract_diff(output)
    if extracted:
        return extracted
    if enable_fallbacks:
        return build_fallback_diff(spec, decisions)
    raise RuntimeError("Gemini CLI did not return a valid unified diff.")


def _build_prompt(spec: str, decisions: list[dict], repo_path: Path) -> str:
    snapshot = _read_codebase(repo_path)
    decisions_text = "\n".join(f"- {decision['description']}" for decision in decisions)
    return f"""You are a senior software engineer implementing an approved architecture specification.

APPROVED DECISIONS:
{decisions_text}

LIVING SPEC:
{spec}

TASK:
Generate a valid unified git diff that implements the approved decisions.
Output only the diff.
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


def _extract_diff(output: str) -> str | None:
    lines = output.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("--- "):
            return "\n".join(lines[index:]) + "\n"
    return None
