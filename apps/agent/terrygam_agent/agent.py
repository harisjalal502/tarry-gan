from __future__ import annotations

import json
from typing import Literal

from .extractor import run_local_agent
from .models import AgentRun, ToolIntent, TranscriptTurn

AgentMode = Literal["auto", "local", "sdk"]


async def run_agent(
    turns: list[TranscriptTurn],
    session_id: str,
    mode: AgentMode = "auto",
) -> AgentRun:
    if mode == "local":
        return run_local_agent(turns, session_id)

    if mode in ("auto", "sdk"):
        try:
            return await _run_openai_agents_sdk(turns, session_id)
        except ModuleNotFoundError:
            if mode == "sdk":
                raise
        except Exception:
            if mode == "sdk":
                raise

    return run_local_agent(turns, session_id)


async def _run_openai_agents_sdk(turns: list[TranscriptTurn], session_id: str) -> AgentRun:
    from agents import Agent, Runner, function_tool

    captured_tool_intents: list[dict] = []

    @function_tool
    def save_memory(events_json: str) -> str:
        """Record room context that should be persisted to GBrain."""
        captured_tool_intents.append(
            {
                "name": "save_memory",
                "arguments": {"events_json": events_json},
                "reason": "The agent chose to persist extracted physical-room context.",
            }
        )
        return "memory write queued"

    @function_tool
    def react(emotion: str, reason: str) -> str:
        """Queue a visible Reachy reaction."""
        captured_tool_intents.append(
            {
                "name": "react",
                "arguments": {"emotion": emotion},
                "reason": reason,
            }
        )
        return "reaction queued"

    @function_tool
    def look_at(target: str, reason: str) -> str:
        """Queue a Reachy gaze target such as center, current_speaker, person_left, person_right, or whiteboard."""
        captured_tool_intents.append(
            {
                "name": "look_at",
                "arguments": {"target": target},
                "reason": reason,
            }
        )
        return "look target queued"

    agent = Agent(
        name="TerryGam Physical Context Agent",
        instructions=(
            "You turn short, speaker-labeled office transcript chunks into useful startup memory. "
            "Extract decisions, risks, questions, follow-ups, and notable insights. "
            "Call save_memory for extracted durable context. Call react only when a room moment deserves visible feedback. "
            "Call look_at when the room context clearly implies a target like current_speaker, person_left, person_right, whiteboard, or center. "
            "Return compact JSON with keys summary and events. Events must match TerryGam's physical context schema."
        ),
        tools=[save_memory, react, look_at],
    )

    prompt = {
        "session_id": session_id,
        "turns": [
            {
                "speaker": turn.speaker,
                "text": turn.text,
                "source": turn.source,
                "timestamp": turn.timestamp,
            }
            for turn in turns
        ],
    }
    result = await Runner.run(agent, input=json.dumps(prompt))
    local = run_local_agent(turns, session_id)
    sdk_tool_intents = tuple(
        ToolIntent(
            name=intent["name"],
            arguments=intent["arguments"],
            reason=intent["reason"],
        )
        for intent in captured_tool_intents
        if intent["name"] in {"save_memory", "search_memory", "react", "look_at"}
    )

    # The SDK handles model reasoning and tool choice. Until we enforce structured
    # outputs, keep our schema-stable local extraction as the artifact returned to
    # the dashboard and attach SDK mode for observability.
    return AgentRun(
        mode="sdk",
        session_id=session_id,
        summary=str(result.final_output or local.summary),
        events=local.events,
        tool_intents=sdk_tool_intents or local.tool_intents,
    )
