from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from ..shared.contracts import AgentPayload, DecisionCategory, DriftSeverity
from ..shared.settings import get_settings
from .prompts import APPSEC_AGENT_PROMPT, DRIFT_DETECTION_PROMPT, RISK_AUTOPSY_PROMPT, SUPERVISOR_PROMPT

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:  # pragma: no cover - optional dependency
    ChatGoogleGenerativeAI = None


class AIProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._llm = None
        if ChatGoogleGenerativeAI and self.settings.gemini_api_key:
            self._llm = ChatGoogleGenerativeAI(
                google_api_key=self.settings.gemini_api_key,
                model=self.settings.gemini_model,
                temperature=0,
            )

    async def analyze_supervisor(self, chat_history: list[dict], existing_decisions: list[dict], current_goal: str) -> dict[str, Any]:
        if self._llm:
            prompt = SUPERVISOR_PROMPT.format(
                current_goal=current_goal,
                existing_decisions=json.dumps(existing_decisions),
                chat_history="\n".join(f"[{m['sender']}]: {m['message']}" for m in chat_history),
            )
            response = await self._llm.ainvoke(prompt)
            return _parse_json_object(response.content)
        return fallback_supervisor(chat_history, existing_decisions, current_goal)

    async def detect_drift(self, proposed_decision: str, snapshot: str) -> dict[str, Any]:
        if self._llm:
            prompt = DRIFT_DETECTION_PROMPT.format(proposed_decision=proposed_decision, codebase_snapshot=snapshot)
            response = await self._llm.ainvoke(prompt)
            return parse_drift_response(response.content, proposed_decision)
        return fallback_drift_detection(proposed_decision, snapshot)

    async def risk_autopsy(self, decisions: list[dict], conflicts_resolved: int, drift_alerts: int) -> str:
        if self._llm:
            prompt = RISK_AUTOPSY_PROMPT.format(
                decisions=json.dumps(decisions, default=str, indent=2),
                conflicts_resolved=conflicts_resolved,
                drift_alerts=drift_alerts,
            )
            response = await self._llm.ainvoke(prompt)
            return response.content
        return fallback_risk_autopsy(decisions, conflicts_resolved, drift_alerts)

    async def appsec_review(self, approved_decisions: list[dict], snapshot: str) -> AgentPayload:
        if self._llm:
            prompt = APPSEC_AGENT_PROMPT.format(
                approved_decisions=json.dumps(approved_decisions, default=str, indent=2),
                codebase_snapshot=snapshot,
            )
            response = await self._llm.ainvoke(prompt)
            return AgentPayload(
                agent_name="AppSec",
                agent_emoji="🛡",
                response=response.content.strip(),
                referenced_files=extract_files_from_snapshot(snapshot),
            )
        return fallback_appsec_review(approved_decisions, snapshot)


def _parse_json_object(content: str) -> dict[str, Any]:
    start = content.find("{")
    end = content.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(content[start:end])
    return {}


def fallback_supervisor(chat_history: list[dict], existing_decisions: list[dict], current_goal: str) -> dict[str, Any]:
    text_messages = [message["message"].strip() for message in chat_history if message.get("message")]
    combined = "\n".join(text_messages)
    goal = current_goal
    goal_match = re.search(r"(?:build|building)\s+(.+?)(?:\.|$)", combined, flags=re.IGNORECASE)
    if goal_match:
        goal = goal_match.group(1).strip()

    latest_conflict = None
    if len(text_messages) >= 2:
        left, right = text_messages[-2], text_messages[-1]
        if ("rather" in right.lower() or "instead" in right.lower()) and ("use" in left.lower() or "should" in left.lower()):
            latest_conflict = {
                "summary": "Team disagreement detected over an implementation choice.",
                "option_a": summarize_option(left),
                "option_b": summarize_option(right),
                "context": left,
            }

    new_decisions = []
    seen = {item["description"].strip().lower() for item in existing_decisions}
    for message in text_messages[-5:]:
        normalized = message.lower()
        category = infer_category(normalized)
        decision = None
        if "we voted" in normalized:
            decision = message.split("we voted", 1)[1].strip(" .")
        elif "let's use" in normalized:
            decision = message.split("Let's use", 1)[1].strip(" .") if "Let's use" in message else message.split("let's use", 1)[1].strip(" .")
        elif "we should use" in normalized:
            decision = message.split("use", 1)[1].strip(" .")
        elif normalized.startswith("use "):
            decision = message[4:].strip(" .")

        if decision:
            description = decision if decision.lower().startswith("use ") else f"Use {decision}"
            if description.strip().lower() not in seen:
                new_decisions.append(
                    {
                        "description": description,
                        "category": category.value,
                        "depends_on": [],
                    }
                )
                seen.add(description.strip().lower())

    tasks = []
    for message in text_messages[-5:]:
        lowered = message.lower()
        if "need to" in lowered:
            tasks.append(message.split("need to", 1)[1].strip(" ."))
        elif "todo" in lowered:
            tasks.append(message.split("todo", 1)[1].strip(" .:"))

    return {
        "new_goal": goal if goal != current_goal else None,
        "new_decisions": new_decisions,
        "new_tasks": list(dict.fromkeys(task for task in tasks if task)),
        "conflict_detected": latest_conflict is not None,
        "conflict": latest_conflict,
    }


def infer_category(text: str) -> DecisionCategory:
    if any(token in text for token in ["auth", "jwt", "oauth", "cookie", "session"]):
        return DecisionCategory.AUTH
    if any(token in text for token in ["postgres", "sqlite", "database", "schema", "orm"]):
        return DecisionCategory.DATABASE
    if any(token in text for token in ["route", "api", "graphql", "rest", "endpoint"]):
        return DecisionCategory.API
    if any(token in text for token in ["frontend", "react", "component", "ui"]):
        return DecisionCategory.FRONTEND
    if any(token in text for token in ["docker", "deploy", "infra", "queue"]):
        return DecisionCategory.INFRA
    if any(token in text for token in ["encrypt", "hash", "security", "sanitize"]):
        return DecisionCategory.SECURITY
    return DecisionCategory.GENERAL


def summarize_option(message: str) -> str:
    cleaned = re.sub(r"^[^a-zA-Z0-9]+", "", message.strip())
    cleaned = cleaned.rstrip(".")
    return cleaned[:120]


def fallback_drift_detection(proposed_decision: str, snapshot: str) -> dict[str, Any]:
    lowered = proposed_decision.lower()
    lines = snapshot.splitlines()
    rules = [
        ("jwt", "session", DriftSeverity.HIGH, "JWT conflicts with existing session-cookie authentication."),
        ("postgres", "sqlite", DriftSeverity.MEDIUM, "Postgres decision conflicts with existing SQLite wiring."),
        ("graphql", "router = apirouter", DriftSeverity.MEDIUM, "GraphQL decision conflicts with the existing REST router layout."),
    ]
    for desired, existing, severity, explanation in rules:
        if desired in lowered:
            for index, line in enumerate(lines, start=1):
                if existing in line.lower():
                    return {
                        "drift_detected": True,
                        "conflicting_file": find_file_for_line(lines, index),
                        "conflicting_line": find_line_number(line),
                        "conflicting_code_snippet": strip_line_number(line),
                        "explanation": explanation,
                        "severity": severity.value,
                        "proposed_decision": proposed_decision,
                    }
    return {
        "drift_detected": False,
        "conflicting_file": "N/A",
        "conflicting_line": 0,
        "conflicting_code_snippet": "N/A",
        "explanation": "No architectural contradiction found.",
        "severity": DriftSeverity.LOW.value,
        "proposed_decision": proposed_decision,
    }


def parse_drift_response(response: str, proposed_decision: str) -> dict[str, Any]:
    result = {
        "drift_detected": False,
        "conflicting_file": "N/A",
        "conflicting_line": 0,
        "conflicting_code_snippet": "N/A",
        "explanation": "No architectural contradiction found.",
        "severity": DriftSeverity.LOW.value,
        "proposed_decision": proposed_decision,
    }
    for line in response.strip().splitlines():
        if line.startswith("DRIFT:"):
            result["drift_detected"] = "yes" in line.lower()
        elif line.startswith("FILE:"):
            result["conflicting_file"] = line.split(":", 1)[1].strip()
        elif line.startswith("LINE:"):
            result["conflicting_line"] = int(line.split(":", 1)[1].strip() or "0")
        elif line.startswith("SNIPPET:"):
            result["conflicting_code_snippet"] = line.split(":", 1)[1].strip()
        elif line.startswith("EXPLANATION:"):
            result["explanation"] = line.split(":", 1)[1].strip()
        elif line.startswith("SEVERITY:"):
            result["severity"] = line.split(":", 1)[1].strip().lower()
    return result


def fallback_risk_autopsy(decisions: list[dict], conflicts_resolved: int, drift_alerts: int) -> str:
    ranked = sorted(decisions, key=lambda item: (len(item.get("depends_on", [])), item.get("risk_score", 0)), reverse=True)
    high_risk = ranked[:3]
    if not high_risk:
        high_risk_text = "- No high-risk decisions recorded."
    else:
        high_risk_text = "\n".join(
            f"- {item['description']} — depends on {len(item.get('depends_on', []))} prior decisions."
            for item in high_risk
        )

    confidence = max(40, 90 - drift_alerts * 10 - max(0, len(decisions) - conflicts_resolved))
    return "\n".join(
        [
            "## High-Risk Decisions",
            high_risk_text,
            "",
            "## Architectural Contradictions Caught",
            f"- Drift alerts caught: {drift_alerts}.",
            "",
            "## What Could Still Go Wrong",
            "- Cross-service contracts can drift if the frontend stops consuming the shared schemas.",
            "- Execution diffs can still fail to apply cleanly against a changed target repository.",
            "",
            f"## Confidence Score: {confidence}/100",
            "The architecture is coherent but still relies on model output quality and repo hygiene.",
        ]
    )


def fallback_appsec_review(approved_decisions: list[dict], snapshot: str) -> AgentPayload:
    observations = []
    lowered = snapshot.lower()
    if "session_id" in lowered:
        observations.append("- Session-cookie auth exists; ensure CSRF protection and cookie flags are explicit.")
    if "sqlite3.connect" in lowered:
        observations.append("- SQLite usage suggests local persistence assumptions; review secret storage and concurrency limits.")
    if not observations:
        observations.append("- No obvious critical issues in the sampled files, but auth and transport hardening still need review.")
    observations.append("- Critical action item: add explicit auth, input validation, and secure cookie tests before shipping.")
    return AgentPayload(
        agent_name="AppSec",
        agent_emoji="🛡",
        response="AppSec review:\n" + "\n".join(observations),
        referenced_files=extract_files_from_snapshot(snapshot),
    )


def extract_files_from_snapshot(snapshot: str) -> list[str]:
    return [line.replace("### FILE: ", "").strip() for line in snapshot.splitlines() if line.startswith("### FILE: ")]


def find_file_for_line(lines: list[str], index: int) -> str:
    for cursor in range(index - 1, -1, -1):
        if lines[cursor].startswith("### FILE: "):
            return lines[cursor].replace("### FILE: ", "").strip()
    return "unknown"


def find_line_number(line: str) -> int:
    match = re.match(r"(\d+):", line.strip())
    return int(match.group(1)) if match else 0


def strip_line_number(line: str) -> str:
    return re.sub(r"^\d+:\s*", "", line.strip())
