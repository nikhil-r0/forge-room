from __future__ import annotations

from datetime import UTC, datetime


def build_fallback_summary(spec_markdown: str, approved_decisions: list[dict]) -> str:
    summary_decisions = "\n".join(f"- {decision['description']}" for decision in approved_decisions) or "- No decisions provided"
    content = (
        "# ForgeRoom Generated Summary (Fallback)\n\n"
        f"Generated: {datetime.now(UTC).isoformat()}\n\n"
        "## Approved Decisions\n"
        f"{summary_decisions}\n\n"
        "## Source Spec\n"
        f"{spec_markdown.strip() or 'No spec provided.'}\n\n"
        "Note: This is a fallback summary because the Gemini CLI was not available or failed."
    )
    return content
