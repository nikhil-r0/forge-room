from __future__ import annotations

from datetime import UTC, datetime


def build_fallback_diff(spec_markdown: str, approved_decisions: list[dict]) -> str:
    summary = "\n".join(f"- {decision['description']}" for decision in approved_decisions) or "- No decisions provided"
    content = (
        "# ForgeRoom Generated Plan\n\n"
        f"Generated: {datetime.now(UTC).isoformat()}\n\n"
        "## Approved Decisions\n"
        f"{summary}\n\n"
        "## Source Spec\n"
        f"{spec_markdown.strip() or 'No spec provided.'}\n"
    )
    lines = content.splitlines()
    diff_lines = [
        "--- /dev/null",
        "+++ b/forgeroom_generated.md",
        "@@ -0,0 +1,{} @@".format(len(lines)),
    ]
    diff_lines.extend(f"+{line}" for line in lines)
    return "\n".join(diff_lines) + "\n"
