from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from ..shared.settings import get_settings
from .fallbacks import build_fallback_summary


import json
import logging

# Setup Execution Bridge logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("execution_bridge")

async def run_gemini_cli(
    spec: str,
    decisions: list[dict],
    repo_path: Path,
    enable_fallbacks: bool = True,
    commit_message: str | None = None,
    push: bool = False,
) -> str:
    settings = get_settings()
    prompt = _build_prompt(spec, decisions, repo_path, commit_message, push)
    executable = shutil.which("gemini")
    logger.info(f"🚀 Execution Bridge: Target Repo -> {repo_path}")
    
    if not executable:
        logger.error("❌ Gemini CLI executable not found in PATH")
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError("Gemini CLI is not installed.")

    # Prepare environment with correctly named API keys and workspace trust
    env = os.environ.copy()
    env["GEMINI_CLI_TRUST_WORKSPACE"] = "true"
    if settings.gemini_api_key:
        env["GEMINI_API_KEY"] = settings.gemini_api_key
        env["GOOGLE_API_KEY"] = settings.gemini_api_key

    cmd = [executable, "--approval-mode", "yolo", "--output-format", "json"]
    logger.info(f"Running command: {' '.join(cmd)}")

    try:
        # Standard headless execution with YOLO mode to auto-apply changes
        result = subprocess.run(
            cmd,
            cwd=repo_path,
            input=prompt,
            capture_output=True,
            text=True,
            env=env,
        )
    except Exception as exc:
        logger.exception("❌ Gemini CLI subprocess failed")
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError(f"Gemini CLI failed: {exc}")

    if result.returncode != 0:
        logger.error(f"❌ Gemini CLI exited with code {result.returncode}")
        logger.error(f"STDOUT: {result.stdout}")
        logger.error(f"STDERR: {result.stderr}")
        
        try:
            error_data = json.loads(result.stdout)
            if "error" in error_data:
                raise RuntimeError(error_data["error"].get("message", "Unknown CLI error"))
        except:
            pass

        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError(result.stderr.strip() or f"Gemini CLI failed with code {result.returncode}")

    try:
        data = json.loads(result.stdout)
        summary = data.get("response", "No response returned from Gemini.")
        logger.info("✅ Gemini CLI execution successful")
        return summary
    except json.JSONDecodeError:
        logger.error("❌ Failed to parse Gemini CLI output as JSON")
        logger.debug(f"RAW OUTPUT: {result.stdout}")
        if enable_fallbacks:
            return build_fallback_summary(spec, decisions)
        raise RuntimeError("Failed to parse Gemini CLI output as JSON.")


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
You are running in a headless automation environment. Use your file management and shell tools to implement the approved decisions directly in the codebase at {repo_path}.{task_ext}

After modifying the files, provide a complete summary of the changes you made and the logic behind them.
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
