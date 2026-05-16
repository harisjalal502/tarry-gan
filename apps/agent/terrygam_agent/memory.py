from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .models import AgentRun, PhysicalContextEvent, TranscriptTurn

SOURCE_ID = "tarry-office"
REPO_ROOT = Path(__file__).resolve().parents[3]
BRAIN_ROOT = REPO_ROOT / "brain"


@dataclass(frozen=True)
class MemoryWriteResult:
    status: str
    session_id: str
    slug: str
    markdown_path: str
    jsonl_path: str
    gbrain_source: str = SOURCE_ID
    gbrain_put: bool = False
    gbrain_error: str | None = None
    local_event_count: int = 0
    written_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_json(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "session_id": self.session_id,
            "slug": self.slug,
            "markdown_path": self.markdown_path,
            "jsonl_path": self.jsonl_path,
            "gbrain_source": self.gbrain_source,
            "gbrain_put": self.gbrain_put,
            "gbrain_error": self.gbrain_error,
            "local_event_count": self.local_event_count,
            "written_at": self.written_at,
        }


def write_live_session_memory(
    *,
    session_id: str,
    turns: list[TranscriptTurn],
    agent_run: AgentRun,
) -> MemoryWriteResult | None:
    meaningful_events = [event for event in agent_run.events if event.type != "transcript"]
    if not turns and not meaningful_events:
        return None

    slug = f"live-sessions/{slugify(session_id)}"
    markdown_path = BRAIN_ROOT / f"{slug}.md"
    jsonl_path = BRAIN_ROOT / "sources" / "physical-room" / f"{slugify(session_id)}.live.events.jsonl"

    markdown = build_live_session_page(session_id=session_id, turns=turns, agent_run=agent_run)
    events_jsonl = "\n".join(json.dumps(event.to_json(), ensure_ascii=False) for event in agent_run.events) + "\n"

    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    jsonl_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown, encoding="utf-8")
    jsonl_path.write_text(events_jsonl, encoding="utf-8")

    gbrain_put = False
    gbrain_error = None
    try:
        gbrain_put_page(slug, markdown)
        gbrain_put = True
    except Exception as error:
        gbrain_error = str(error)

    return MemoryWriteResult(
        status="gbrain_written" if gbrain_put else "local_fallback_written",
        session_id=session_id,
        slug=slug,
        markdown_path=str(markdown_path.relative_to(REPO_ROOT)),
        jsonl_path=str(jsonl_path.relative_to(REPO_ROOT)),
        gbrain_put=gbrain_put,
        gbrain_error=gbrain_error,
        local_event_count=len(agent_run.events),
    )


def gbrain_put_page(slug: str, markdown: str) -> None:
    env = os.environ.copy()
    env.setdefault("GBRAIN_HOME", str(REPO_ROOT / ".gbrain-home"))
    env["GBRAIN_SOURCE"] = SOURCE_ID
    result = subprocess.run(
        ["gbrain", "put", slug],
        input=markdown,
        text=True,
        capture_output=True,
        cwd=REPO_ROOT,
        env=env,
        timeout=25,
        check=False,
    )
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "gbrain put failed").strip()
        raise RuntimeError(message)


def build_live_session_page(
    *,
    session_id: str,
    turns: list[TranscriptTurn],
    agent_run: AgentRun,
) -> str:
    title = f"Live room session {session_id}"
    written_at = datetime.now(UTC).isoformat()
    summary = readable_summary(agent_run.summary)
    transcript = "\n".join(f"- **{turn.speaker}:** {turn.text}" for turn in turns) or "- None captured yet."
    extracted = "\n".join(
        f"- **{event.type}:** {event.text}"
        for event in agent_run.events
        if event.type != "transcript"
    ) or "- None extracted yet."
    tool_intents = "\n".join(
        f"- **{intent.name}:** {intent.reason} `{json.dumps(intent.arguments, ensure_ascii=False)}`"
        for intent in agent_run.tool_intents
    ) or "- None."

    return f"""---
title: "{title}"
type: "meeting"
source: "{SOURCE_ID}"
session_id: "{session_id}"
date: "{written_at[:10]}"
tags: ["tarry", "physical-context", "live-room", "gbrain"]
---

# {title}

> Executive summary: {summary}

## State

- **Capture mode:** Live browser/room capture.
- **Physical layers:** Diarized audio, dashboard-visible context extraction, and optional robot vision.
- **Memory target:** GBrain source `{SOURCE_ID}`.
- **Written at:** {written_at}

## Speaker-Separated Transcript

{transcript}

## Extracted Context

{extracted}

## Agent Tool Intents

{tool_intents}

---

## Timeline

- **{written_at[:10]}** | Tarry live session - Captured room transcript and extracted physical context into GBrain-backed memory.
"""


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "live-session"


def readable_summary(summary: str) -> str:
    try:
        payload = json.loads(summary)
    except json.JSONDecodeError:
        return summary
    if isinstance(payload, dict) and isinstance(payload.get("summary"), str):
        return payload["summary"]
    return summary
