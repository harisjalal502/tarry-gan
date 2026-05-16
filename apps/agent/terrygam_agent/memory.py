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


@dataclass(frozen=True)
class MemorySearchMatch:
    slug: str
    snippet: str
    score: float | None = None
    source: str = SOURCE_ID

    def to_json(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "snippet": self.snippet,
            "score": self.score,
            "source": self.source,
        }


@dataclass(frozen=True)
class MemoryQueryResult:
    mode: str
    query: str
    answer: str
    matches: tuple[MemorySearchMatch, ...]
    source: str = SOURCE_ID
    error: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "query": self.query,
            "answer": self.answer,
            "matches": [match.to_json() for match in self.matches],
            "source": self.source,
            "error": self.error,
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


def query_memory(query: str, *, limit: int = 5, source: str = SOURCE_ID) -> MemoryQueryResult:
    query = query.strip()
    if not query:
        raise ValueError("query is required")

    try:
        matches = gbrain_search(query, limit=limit, source=source)
        if matches:
            return MemoryQueryResult(
                mode="gbrain",
                query=query,
                answer=build_retrieval_answer(query, matches),
                matches=tuple(matches),
                source=source,
            )
    except Exception as error:
        fallback_matches = local_search(query, limit=limit, source=source)
        return MemoryQueryResult(
            mode="local_fallback",
            query=query,
            answer=build_retrieval_answer(query, fallback_matches),
            matches=tuple(fallback_matches),
            source=source,
            error=str(error),
        )

    fallback_matches = local_search(query, limit=limit, source=source)
    return MemoryQueryResult(
        mode="local_fallback",
        query=query,
        answer=build_retrieval_answer(query, fallback_matches),
        matches=tuple(fallback_matches),
        source=source,
        error="GBrain search returned no matches.",
    )


def gbrain_search(query: str, *, limit: int, source: str) -> list[MemorySearchMatch]:
    env = os.environ.copy()
    env.setdefault("GBRAIN_HOME", str(REPO_ROOT / ".gbrain-home"))
    result = subprocess.run(
        ["gbrain", "search", query, "--source", source],
        text=True,
        capture_output=True,
        cwd=REPO_ROOT,
        env=env,
        timeout=20,
        check=False,
    )
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "gbrain search failed").strip()
        raise RuntimeError(message)
    return parse_gbrain_search_output(result.stdout, source=source)[:limit]


def parse_gbrain_search_output(output: str, *, source: str) -> list[MemorySearchMatch]:
    matches: list[MemorySearchMatch] = []
    for line in output.splitlines():
        match = re.match(r"^\[(?P<score>[0-9.]+)\]\s+(?P<slug>\S+)\s+--\s+(?P<snippet>.*)$", line.strip())
        if not match:
            continue
        matches.append(
            MemorySearchMatch(
                slug=match.group("slug"),
                snippet=match.group("snippet").strip(),
                score=float(match.group("score")),
                source=source,
            )
        )
    return matches


def local_search(query: str, *, limit: int, source: str) -> list[MemorySearchMatch]:
    terms = [term for term in re.findall(r"[a-z0-9]+", query.lower()) if len(term) > 2]
    candidates: list[tuple[int, MemorySearchMatch]] = []
    for path in sorted(BRAIN_ROOT.glob("**/*.md")):
        if path.name in {"README.md", "RESOLVER.md", "schema.md"}:
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        content_lower = content.lower()
        score = sum(content_lower.count(term) for term in terms)
        if score <= 0:
            continue
        slug = str(path.relative_to(BRAIN_ROOT)).removesuffix(".md")
        candidates.append(
            (
                score,
                MemorySearchMatch(
                    slug=slug,
                    snippet=best_snippet(content, terms),
                    score=float(score),
                    source=source,
                ),
            )
        )
    candidates.sort(key=lambda item: item[0], reverse=True)
    return [match for _, match in candidates[:limit]]


def best_snippet(content: str, terms: list[str], max_length: int = 220) -> str:
    flattened = re.sub(r"\s+", " ", content).strip()
    if not flattened:
        return ""
    lower = flattened.lower()
    index = min((lower.find(term) for term in terms if lower.find(term) >= 0), default=0)
    start = max(0, index - 70)
    snippet = flattened[start : start + max_length].strip()
    return snippet


def build_retrieval_answer(query: str, matches: list[MemorySearchMatch]) -> str:
    if not matches:
        return f"No saved Tarry room memories matched: {query}"

    best = matches[0]
    source_list = ", ".join(match.slug for match in matches[:3])
    snippet = best.snippet.strip()
    if len(snippet) > 320:
        snippet = f"{snippet[:317]}..."
    return (
        f"Tarry found {len(matches)} relevant memory page(s). "
        f"Best match: {best.slug}. "
        f"Relevant context: {snippet} "
        f"Sources: {source_list}."
    )
