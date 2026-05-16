from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

EventType = Literal[
    "transcript",
    "context",
    "decision",
    "risk",
    "question",
    "follow_up",
    "whiteboard_observation",
    "face_detection",
    "gaze",
    "attention",
    "reaction",
    "audio_signal",
    "scene_summary",
    "memory_write",
    "retrieval_answer",
]

SourceType = Literal[
    "robot_camera",
    "robot_microphone",
    "browser_microphone",
    "manual",
    "replay",
    "physical_room",
    "robot",
    "gbrain",
]


@dataclass(frozen=True)
class TranscriptTurn:
    speaker: str
    text: str
    source: SourceType = "browser_microphone"
    confidence: float = 0.95
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())


@dataclass(frozen=True)
class PhysicalContextEvent:
    type: EventType
    source: SourceType
    text: str
    session_id: str
    confidence: float = 0.8
    tags: tuple[str, ...] = ()
    speaker: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: f"evt_{uuid4().hex[:12]}")
    timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_json(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "type": self.type,
            "source": self.source,
            "text": self.text,
            "timestamp": self.timestamp,
            "session_id": self.session_id,
            "confidence": self.confidence,
            "tags": list(self.tags),
            "metadata": self.metadata,
        }
        if self.speaker:
            payload["speaker"] = {
                "label": self.speaker,
                "confidence": self.confidence,
            }
        return payload


@dataclass(frozen=True)
class ToolIntent:
    name: Literal["save_memory", "search_memory", "react", "look_at"]
    arguments: dict[str, Any]
    reason: str

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "arguments": self.arguments,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class AgentRun:
    mode: Literal["local", "sdk"]
    session_id: str
    summary: str
    events: tuple[PhysicalContextEvent, ...]
    tool_intents: tuple[ToolIntent, ...]

    def to_json(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "session_id": self.session_id,
            "summary": self.summary,
            "events": [event.to_json() for event in self.events],
            "tool_intents": [intent.to_json() for intent in self.tool_intents],
        }
