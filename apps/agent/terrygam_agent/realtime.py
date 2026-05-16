from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from .memory import query_memory, write_realtime_memory_event
from .robot import dispatch_robot_action

OPENAI_REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"
DEFAULT_REALTIME_MODEL = "gpt-realtime-2"


REALTIME_INSTRUCTIONS = """
You are Tarry, the embodied office context layer for a small startup team.
You are not a conversational assistant in this mode. You are a silent realtime
tool router and perception/event producer. Listen while the team talks, notice
decisions, risks, follow-ups, whiteboard or room context, and use tools.

Tool policy:
- Safe demo mode is active. Call look_at or react only when a user explicitly asks the robot to move or react.
- For look_at/react, set explicit_command=true only when the user gives a direct command such as "look left", "look at the whiteboard", "react", "celebrate", "nod", or "move".
- Do not move the robot for ambient conversation, repeated face detections, ordinary speaker changes, or generic "interesting" moments.
- Call save_memory only when the team states a durable decision, risk, owner, follow-up, customer/investor prep note, or important meeting context.
- Do not call save_memory for casual chatter, noisy partial transcript, repeated facts, raw face counts, or generic room observations.
- Call search_memory when the user asks what was previously decided or needs meeting/customer/investor prep.
- Do not claim you can see something unless an image or explicit vision observation was provided.
- Do not answer out loud. Prefer tool calls over text. If no tool is appropriate, stay quiet.
""".strip()


REALTIME_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "look_at",
        "description": "Move Reachy's attention toward a room target.",
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "enum": ["center", "current_speaker", "person_left", "person_right", "whiteboard"],
                    "description": "The target Reachy should look toward.",
                },
                "reason": {
                    "type": "string",
                    "description": "Why the robot should visibly attend to this target.",
                },
                "explicit_command": {
                    "type": "boolean",
                    "description": "True only when the user directly requested this robot movement.",
                },
            },
            "required": ["target"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "react",
        "description": "Trigger a small embodied robot reaction.",
        "parameters": {
            "type": "object",
            "properties": {
                "emotion": {
                    "type": "string",
                    "enum": ["thoughtful_ack", "insight", "risk", "confused", "celebrate"],
                    "description": "The reaction style to perform.",
                },
                "reason": {
                    "type": "string",
                    "description": "Why this room moment deserves a reaction.",
                },
                "explicit_command": {
                    "type": "boolean",
                    "description": "True only when the user directly requested this robot reaction.",
                },
            },
            "required": ["emotion"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "save_memory",
        "description": "Persist durable physical-room context into GBrain-backed memory.",
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "Stable live room session id.",
                },
                "text": {
                    "type": "string",
                    "description": "The memory-worthy context to save.",
                },
                "event_type": {
                    "type": "string",
                    "enum": [
                        "context",
                        "decision",
                        "risk",
                        "question",
                        "follow_up",
                        "whiteboard_observation",
                        "scene_summary",
                    ],
                    "description": "The kind of memory event.",
                },
                "source": {
                    "type": "string",
                    "enum": ["browser_microphone", "robot_microphone", "robot_camera", "physical_room", "manual"],
                    "description": "Where the observation came from.",
                },
                "tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Short tags for retrieval.",
                },
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "search_memory",
        "description": "Search GBrain-backed office memory for relevant prior room context.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The memory search query.",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "description": "Maximum number of memory matches to return.",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


def build_realtime_session_payload(*, session_id: str = "live-room-realtime") -> dict[str, Any]:
    return {
        "session": {
            "type": "realtime",
            "model": os.getenv("OPENAI_REALTIME_MODEL", DEFAULT_REALTIME_MODEL),
            "instructions": f"{REALTIME_INSTRUCTIONS}\n\nCurrent session_id: {session_id}. Use it when calling save_memory.",
            "audio": {
                "input": {
                    "noise_reduction": {
                        "type": os.getenv("OPENAI_REALTIME_NOISE_REDUCTION", "far_field"),
                    },
                    "transcription": {
                        "model": os.getenv("OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-transcribe"),
                        "language": os.getenv("OPENAI_REALTIME_LANGUAGE", "en"),
                    },
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": float(os.getenv("OPENAI_REALTIME_VAD_THRESHOLD", "0.5")),
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": int(os.getenv("OPENAI_REALTIME_SILENCE_MS", "500")),
                    },
                },
            },
            "output_modalities": ["text"],
            "tools": REALTIME_TOOLS,
            "tool_choice": "auto",
            "max_output_tokens": 1024,
        }
    }


def create_realtime_client_secret(*, session_id: str = "live-room-realtime") -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required to create a Realtime client secret.")

    body = json.dumps(build_realtime_session_payload(session_id=session_id)).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_REALTIME_CLIENT_SECRETS_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI Realtime client secret failed: HTTP {error.code}: {detail}") from error


def dispatch_realtime_tool(name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    args = arguments or {}

    if name == "look_at":
        blocked = safe_demo_robot_block(name, args)
        if blocked:
            return blocked
        return {
            "type": "robot_action",
            "result": dispatch_robot_action("look_at", {"target": args.get("target", "current_speaker")}).to_json(),
        }

    if name == "react":
        blocked = safe_demo_robot_block(name, args)
        if blocked:
            return blocked
        return {
            "type": "robot_action",
            "result": dispatch_robot_action("react", {"emotion": args.get("emotion", "thoughtful_ack")}).to_json(),
        }

    if name == "save_memory":
        text = str(args.get("text") or "").strip()
        if not text:
            raise ValueError("save_memory requires text.")
        result = write_realtime_memory_event(
            session_id=str(args.get("session_id") or "live-room-realtime"),
            text=text,
            event_type=str(args.get("event_type") or "context"),
            source=str(args.get("source") or "physical_room"),
            tags=tuple(str(tag) for tag in args.get("tags", []) if str(tag).strip()),
            metadata={"origin": "gpt-realtime-2"},
        )
        return {"type": "memory_write", "result": result.to_json()}

    if name == "search_memory":
        query = str(args.get("query") or "").strip()
        if not query:
            raise ValueError("search_memory requires query.")
        result = query_memory(query, limit=int(args.get("limit") or 5))
        return {"type": "memory_query", "result": result.to_json()}

    raise ValueError(f"Unknown realtime tool: {name}")


def safe_demo_robot_block(name: str, args: dict[str, Any]) -> dict[str, Any] | None:
    if os.getenv("TERRYGAM_SAFE_DEMO_MODE", "1") != "1":
        return None
    if args.get("explicit_command") is True:
        return None
    return {
        "type": "robot_action_blocked",
        "result": {
            "ok": False,
            "mode": os.getenv("TERRYGAM_ROBOT_MODE", "mock"),
            "action": name,
            "message": "Safe demo mode blocked ambient robot motion. Ask explicitly to move or react.",
            "arguments": args,
        },
    }
