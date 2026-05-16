from __future__ import annotations

import asyncio
from email.parser import BytesParser
from email.policy import default
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .agent import run_agent
from .memory import write_live_session_memory
from .models import TranscriptTurn
from .robot import dispatch_robot_action, dispatch_robot_tool_intent
from .transcription import DIARIZE_MODEL, transcribe_diarized_audio

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
DEFAULT_MODE = "sdk"

SESSIONS: dict[str, list[TranscriptTurn]] = {}
DEBUG_RUNS: list[dict[str, Any]] = []


class AgentRequestHandler(BaseHTTPRequestHandler):
    server_version = "TerryGamAgent/0.1"

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json({"ok": True, "service": "terrygam-agent", "diarize_model": DIARIZE_MODEL})
            return
        if self.path == "/debug/sessions":
            self._send_json(
                {
                    "sessions": {
                        session_id: [
                            {"speaker": turn.speaker, "text": turn.text, "source": turn.source}
                            for turn in turns
                        ]
                        for session_id, turns in SESSIONS.items()
                    },
                    "runs": DEBUG_RUNS[-20:],
                }
            )
            return
        if self.path == "/robot/status":
            self._send_json(dispatch_robot_action("status").to_json())
            return
        self._send_json({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        if self.path.startswith("/robot/"):
            self._handle_robot_action()
            return

        if self.path == "/agent/audio-turn":
            self._handle_audio_turn()
            return

        if self.path == "/agent/turn":
            self._handle_text_turn()
            return

        self._send_json({"error": "not found"}, status=404)

    def _handle_text_turn(self) -> None:
        try:
            payload = self._read_json()
            session_id = str(payload.get("session_id") or "live-room-observation")
            speaker = str(payload.get("speaker") or "speaker_1")
            text = str(payload.get("text") or "").strip()
            source = str(payload.get("source") or "browser_microphone")
            mode = str(payload.get("mode") or os.getenv("TERRYGAM_AGENT_MODE") or DEFAULT_MODE)

            if not text:
                self._send_json({"error": "text is required"}, status=400)
                return

            turn = TranscriptTurn(speaker=speaker, text=text, source=source)  # type: ignore[arg-type]
            turns = SESSIONS.setdefault(session_id, [])
            turns.append(turn)

            result = asyncio.run(run_agent(turns, session_id=session_id, mode=mode))  # type: ignore[arg-type]
            response = result.to_json()
            response["received_turn"] = {
                "speaker": speaker,
                "text": text,
                "source": source,
            }
            response["memory_write"] = _write_memory_if_requested(session_id, turns, result)
            _attach_robot_actions(response)
            _record_debug_run("text", response)
            self._send_json(response)
        except Exception as error:
            self._send_json({"error": str(error)}, status=500)

    def _handle_audio_turn(self) -> None:
        try:
            form = self._read_multipart()
            session_id = str(form.get("session_id") or "live-room-observation")
            source = str(form.get("source") or "browser_microphone")
            mode = str(form.get("mode") or os.getenv("TERRYGAM_AGENT_MODE") or DEFAULT_MODE)
            file_payload = form.get("file")

            if not isinstance(file_payload, dict):
                self._send_json({"error": "multipart field 'file' is required"}, status=400)
                return

            transcript_turns, transcription_payload = transcribe_diarized_audio(
                file_payload["content"],
                filename=file_payload["filename"],
                mime_type=file_payload["content_type"],
                source=source,
            )

            if not transcript_turns:
                self._send_json({"error": "OpenAI returned no transcript text"}, status=422)
                return

            turns = SESSIONS.setdefault(session_id, [])
            turns.extend(transcript_turns)
            result = asyncio.run(run_agent(turns, session_id=session_id, mode=mode))  # type: ignore[arg-type]
            response = result.to_json()
            response["received_turns"] = [
                {"speaker": turn.speaker, "text": turn.text, "source": turn.source}
                for turn in transcript_turns
            ]
            response["transcription"] = {
                "model": DIARIZE_MODEL,
                "text": transcription_payload.get("text", ""),
                "segment_count": len(transcription_payload.get("segments") or []),
            }
            response["memory_write"] = _write_memory_if_requested(session_id, turns, result)
            _attach_robot_actions(response)
            _record_debug_run("audio", response)
            self._send_json(response)
        except Exception as error:
            self._send_json({"error": str(error)}, status=500)

    def _handle_robot_action(self) -> None:
        try:
            action = self.path.removeprefix("/robot/").replace("-", "_")
            payload = self._read_json()
            result = dispatch_robot_action(action, payload)
            self._send_json(result.to_json(), status=200 if result.ok else 409)
        except Exception as error:
            self._send_json({"error": str(error)}, status=500)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[agent] {self.address_string()} - {format % args}")

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def _read_multipart(self) -> dict[str, Any]:
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        )

        fields: dict[str, Any] = {}
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            filename = part.get_filename()
            content = part.get_payload(decode=True) or b""
            if filename:
                fields[name] = {
                    "filename": filename,
                    "content_type": part.get_content_type(),
                    "content": content,
                }
            else:
                fields[name] = content.decode("utf-8")
        return fields

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)


def _record_debug_run(kind: str, response: dict[str, Any]) -> None:
    DEBUG_RUNS.append(
        {
            "kind": kind,
            "mode": response.get("mode"),
            "session_id": response.get("session_id"),
            "received_turns": response.get("received_turns") or [response.get("received_turn")],
            "event_count": len(response.get("events") or []),
            "tool_intent_count": len(response.get("tool_intents") or []),
            "robot_actions": response.get("robot_actions") or [],
            "transcription": response.get("transcription"),
            "memory_write": response.get("memory_write"),
        }
    )
    del DEBUG_RUNS[:-50]


def _write_memory_if_requested(
    session_id: str,
    turns: list[TranscriptTurn],
    result: Any,
) -> dict[str, Any] | None:
    if not any(intent.name == "save_memory" for intent in result.tool_intents):
        return None
    write_result = write_live_session_memory(
        session_id=session_id,
        turns=turns,
        agent_run=result,
    )
    return write_result.to_json() if write_result else None


def _attach_robot_actions(response: dict[str, Any]) -> None:
    actions = []
    for intent in response.get("tool_intents") or []:
        result = dispatch_robot_tool_intent(intent)
        if result:
            actions.append(result.to_json())
    response["robot_actions"] = actions


def load_local_env() -> None:
    env_path = Path(".env.local")
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def main() -> int:
    load_local_env()
    host = os.getenv("TERRYGAM_AGENT_HOST", DEFAULT_HOST)
    port = int(os.getenv("TERRYGAM_AGENT_PORT", str(DEFAULT_PORT)))
    server = ThreadingHTTPServer((host, port), AgentRequestHandler)
    print(f"[agent] listening on http://{host}:{port}")
    print(f"[agent] mode={os.getenv('TERRYGAM_AGENT_MODE', DEFAULT_MODE)}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
