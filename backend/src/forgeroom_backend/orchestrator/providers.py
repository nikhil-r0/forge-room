from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from ..shared.contracts import AgentPayload, DecisionCategory, DriftSeverity
from ..shared.settings import get_settings
from .prompts import (
    APPSEC_AGENT_PROMPT,
    DRIFT_DETECTION_PROMPT,
    RISK_AUTOPSY_PROMPT,
    SKILL_AGENT_PROMPT,
    SUPERVISOR_PROMPT,
)

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:  # pragma: no cover - optional dependency
    ChatGoogleGenerativeAI = None


class AIProvider:
    def __init__(self) -> None:
        import logging
        self.logger = logging.getLogger("orchestrator.provider")
        self.settings = get_settings()
        self._llm = None
        
        if not ChatGoogleGenerativeAI:
            self.logger.error("❌ ChatGoogleGenerativeAI import failed. langchain-google-genai might be missing.")
        
        if not self.settings.gemini_api_key:
            self.logger.warning("⚠️ FORGEROOM_GEMINI_API_KEY is missing. Falling back to local heuristics.")
            
        if ChatGoogleGenerativeAI and self.settings.gemini_api_key:
            try:
                # Explicitly pass the key to avoid missing GOOGLE_API_KEY errors
                self._llm = ChatGoogleGenerativeAI(
                    api_key=self.settings.gemini_api_key,
                    google_api_key=self.settings.gemini_api_key, # Alias for older versions
                    model=self.settings.gemini_model,
                    temperature=0,
                )
                self.logger.info(f"✅ AI Provider initialized with model: {self.settings.gemini_model}")
            except Exception as e:
                self.logger.error(f"❌ Failed to initialize Gemini LLM: {str(e)}")

    async def analyze_supervisor(
        self, 
        chat_history: list[dict], 
        existing_decisions: list[dict], 
        current_goal: str, 
        active_skills: list[dict] | None = None,
        pending_tasks: list[str] | None = None,
        resolved_conflicts: list[dict] | None = None,
        execution_summary: str | None = None
    ) -> dict[str, Any]:
        if self._llm:
            try:
                skills_text = ""
                if active_skills:
                    skills_text = "\n".join(f"--- SKILL: {s['name']} ---\n{s['content']}" for s in active_skills)

                prompt = SUPERVISOR_PROMPT.format(
                    current_goal=current_goal,
                    existing_decisions=json.dumps(existing_decisions, default=str),
                    pending_tasks=json.dumps(pending_tasks or [], default=str),
                    resolved_conflicts=json.dumps(resolved_conflicts or [], default=str),
                    chat_history="\n".join(f"[{m['sender']}]: {m['message']}" for m in chat_history),
                    active_skills=skills_text,
                    execution_summary=execution_summary or "None",
                )
                response = await self._llm.ainvoke(prompt)
                return _parse_json_object(response.content)
            except Exception as e:
                self.logger.error(f"LLM Supervisor Call failed: {str(e)}")

        self.logger.warning("🔄 Switching to Heuristic Fallback for Supervisor")
        return fallback_supervisor(chat_history, existing_decisions, current_goal)

    async def detect_drift(self, proposed_decision: str, snapshot: str) -> dict[str, Any]:
        if self._llm:
            try:
                prompt = DRIFT_DETECTION_PROMPT.format(proposed_decision=proposed_decision, codebase_snapshot=snapshot)
                response = await self._llm.ainvoke(prompt)
                return parse_drift_response(response.content, proposed_decision)
            except Exception as e:
                 self.logger.error(f"LLM Drift Call failed: {str(e)}")
                 
        self.logger.warning(f"🔄 Switching to Heuristic Fallback for Drift Detection ({proposed_decision[:20]}...)")
        return fallback_drift_detection(proposed_decision, snapshot)

    async def risk_autopsy(self, decisions: list[dict], conflicts_resolved: int, drift_alerts: int) -> str:
        if self._llm:
            try:
                prompt = RISK_AUTOPSY_PROMPT.format(
                    decisions=json.dumps(decisions, default=str, indent=2),
                    conflicts_resolved=conflicts_resolved,
                    drift_alerts=drift_alerts,
                )
                response = await self._llm.ainvoke(prompt)
                return response.content
            except Exception as e:
                self.logger.error(f"LLM Risk Autopsy Call failed: {str(e)}")
                
        self.logger.warning("🔄 Switching to Heuristic Fallback for Risk Autopsy")
        return "# Risk Autopsy (Heuristic Fallback)\n\nCould not reach LLM for detailed analysis."

    async def appsec_review(self, approved_decisions: list[dict], snapshot: str) -> AgentPayload:
        if self._llm:
            try:
                prompt = APPSEC_AGENT_PROMPT.format(
                    approved_decisions=json.dumps(approved_decisions, default=str),
                    codebase_snapshot=snapshot,
                )
                response = await self._llm.ainvoke(prompt)
                return AgentPayload(
                    agent_name="AppSec",
                    agent_emoji="🛡",
                    response=response.content.strip(),
                    referenced_files=extract_files_from_snapshot(snapshot),
                )
            except Exception as e:
                self.logger.error(f"LLM AppSec Review Call failed: {str(e)}")
                
        self.logger.warning("🔄 Switching to Heuristic Fallback for AppSec Review")
        return fallback_appsec_review(approved_decisions, snapshot)

    async def invoke_skill_agent(self, agent_name: str, skill_content: str, approved_decisions: list[dict], snapshot: str) -> AgentPayload:
        if self._llm:
            try:
                prompt = SKILL_AGENT_PROMPT.format(
                    agent_name=agent_name,
                    skill_content=skill_content,
                    approved_decisions=json.dumps(approved_decisions, default=str),
                    codebase_snapshot=snapshot,
                )
                response = await self._llm.ainvoke(prompt)
                return AgentPayload(
                    agent_name=agent_name,
                    agent_emoji="👤",
                    response=response.content.strip(),
                    referenced_files=extract_files_from_snapshot(snapshot),
                )
            except Exception as e:
                self.logger.error(f"LLM Skill Agent ({agent_name}) Call failed: {str(e)}")

        return AgentPayload(
            agent_name=agent_name,
            agent_emoji="👤",
            response=f"I'm sorry, I encountered an error while trying to review this session using my {agent_name} skill.",
            referenced_files=[],
        )


def _parse_json_object(content: str) -> dict[str, Any]:
    start = content.find("{")
    end = content.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(content[start:end])
        except Exception:
            return {}
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
            decision = message.split("let's use", 1)[1].strip(" .")
        elif "we should use" in normalized:
            decision = message.split("we should use", 1)[1].strip(" .")
        
        if decision and decision.lower() not in seen:
            new_decisions.append({
                "description": decision.capitalize(),
                "category": category,
                "depends_on": []
            })
            seen.add(decision.lower())

    return {
        "new_goal": goal if goal != current_goal else None,
        "new_decisions": new_decisions,
        "new_tasks": [],
        "completed_tasks": [],
        "conflict_detected": latest_conflict is not None,
        "conflict": latest_conflict
    }


def parse_drift_response(content: str, proposed_decision: str) -> dict[str, Any]:
    lines = content.strip().split("\n")
    result = {
        "drift": "NO",
        "file": "N/A",
        "line": 0,
        "snippet": "N/A",
        "explanation": "No contradiction found",
        "severity": "low"
    }
    for line in lines:
        if ":" not in line: continue
        key, val = line.split(":", 1)
        key = key.strip().upper()
        val = val.strip()
        if key == "DRIFT": result["drift"] = val
        elif key == "FILE": result["file"] = val
        elif key == "LINE": 
            try: result["line"] = int(val)
            except: result["line"] = 0
        elif key == "SNIPPET": result["snippet"] = val
        elif key == "EXPLANATION": result["explanation"] = val
        elif key == "SEVERITY": result["severity"] = val.lower()
    return result


def fallback_drift_detection(proposed_decision: str, snapshot: str) -> dict[str, Any]:
    return {
        "drift": "NO",
        "file": "N/A",
        "line": 0,
        "snippet": "N/A",
        "explanation": "Heuristic fallback: no deep contradiction analysis performed.",
        "severity": "low"
    }


def fallback_appsec_review(approved_decisions: list[dict], snapshot: str) -> AgentPayload:
    return AgentPayload(
        agent_name="AppSec",
        agent_emoji="🛡",
        response="Heuristic fallback: Security review unavailable while Gemini is offline.",
        referenced_files=[]
    )


def extract_files_from_snapshot(snapshot: str) -> list[str]:
    # Looks for [FILE: path/to/file.py]
    return re.findall(r"\[FILE:\s*(.+?)\]", snapshot)


def infer_category(text: str) -> str:
    text = text.lower()
    if any(k in text for k in ["auth", "login", "jwt", "password", "session"]): return "auth"
    if any(k in text for k in ["db", "sql", "postgres", "mongo", "table", "schema"]): return "database"
    if any(k in text for k in ["api", "endpoint", "rest", "graphql", "http", "route"]): return "api"
    if any(k in text for k in ["ui", "css", "html", "react", "component", "frontend"]): return "frontend"
    if any(k in text for k in ["aws", "docker", "deploy", "cloud", "infra"]): return "infra"
    if any(k in text for k in ["security", "encrypt", "secret", "vault", "firewall"]): return "security"
    return "general"


def summarize_option(text: str) -> str:
    return text[:60] + "..." if len(text) > 60 else text
