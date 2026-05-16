from __future__ import annotations

from .models import AgentRun, PhysicalContextEvent, ToolIntent, TranscriptTurn


DECISION_MARKERS = (
    "decide",
    "decision",
    "we will",
    "let's",
    "ship",
    "pricing",
    "commit",
)
RISK_MARKERS = ("risk", "worried", "blocker", "concern", "trust", "unclear")
FOLLOW_UP_MARKERS = ("follow up", "todo", "next", "need to", "owner", "test")
INSIGHT_MARKERS = ("important", "insight", "learned", "signal", "customer")


def run_local_agent(turns: list[TranscriptTurn], session_id: str) -> AgentRun:
    events: list[PhysicalContextEvent] = []
    tool_intents: list[ToolIntent] = []

    for turn in turns:
        events.append(
            PhysicalContextEvent(
                type="transcript",
                source=turn.source,
                text=turn.text,
                session_id=session_id,
                confidence=turn.confidence,
                speaker=turn.speaker,
                tags=("raw-transcript",),
                timestamp=turn.timestamp,
            )
        )
        events.extend(_extract_events(turn, session_id))

    memory_events = [event for event in events if event.type != "transcript"]
    if memory_events:
        tool_intents.append(
            ToolIntent(
                name="save_memory",
                arguments={
                    "session_id": session_id,
                    "events": [event.to_json() for event in memory_events],
                },
                reason="Persist extracted physical-room context into GBrain.",
            )
        )

    if any(event.type in ("decision", "risk") for event in memory_events):
        tool_intents.append(
            ToolIntent(
                name="react",
                arguments={"emotion": "thoughtful_ack"},
                reason="Give the room ambient feedback when the team surfaces a meaningful decision or risk.",
            )
        )

    summary = _summarize(events)
    return AgentRun(
        mode="local",
        session_id=session_id,
        summary=summary,
        events=tuple(events),
        tool_intents=tuple(tool_intents),
    )


def _extract_events(turn: TranscriptTurn, session_id: str) -> list[PhysicalContextEvent]:
    text = turn.text.strip()
    lower = text.lower()
    events: list[PhysicalContextEvent] = []

    if any(marker in lower for marker in DECISION_MARKERS):
        events.append(
            _event(
                "decision",
                text,
                session_id,
                turn.speaker,
                ("decision", "physical-room"),
            )
        )
    if any(marker in lower for marker in RISK_MARKERS):
        events.append(
            _event(
                "risk",
                text,
                session_id,
                turn.speaker,
                ("risk", "physical-room"),
            )
        )
    if text.endswith("?"):
        events.append(
            _event(
                "question",
                text,
                session_id,
                turn.speaker,
                ("question", "physical-room"),
            )
        )
    if any(marker in lower for marker in FOLLOW_UP_MARKERS):
        events.append(
            _event(
                "follow_up",
                text,
                session_id,
                turn.speaker,
                ("follow-up", "physical-room"),
            )
        )
    if any(marker in lower for marker in INSIGHT_MARKERS):
        events.append(
            _event(
                "context",
                text,
                session_id,
                turn.speaker,
                ("insight", "physical-room"),
            )
        )

    return events


def _event(
    event_type: str,
    text: str,
    session_id: str,
    speaker: str,
    tags: tuple[str, ...],
) -> PhysicalContextEvent:
    return PhysicalContextEvent(
        type=event_type,  # type: ignore[arg-type]
        source="physical_room",
        text=text,
        session_id=session_id,
        confidence=0.72,
        speaker=speaker,
        tags=tags,
    )


def _summarize(events: list[PhysicalContextEvent]) -> str:
    decisions = sum(1 for event in events if event.type == "decision")
    risks = sum(1 for event in events if event.type == "risk")
    follow_ups = sum(1 for event in events if event.type == "follow_up")
    transcript_turns = sum(1 for event in events if event.type == "transcript")
    return (
        f"Processed {transcript_turns} transcript turns and extracted "
        f"{decisions} decisions, {risks} risks, and {follow_ups} follow-ups."
    )
