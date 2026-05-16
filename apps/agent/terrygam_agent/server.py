from __future__ import annotations

import asyncio
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .agent import run_agent
from .models import TranscriptTurn

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
DEFAULT_MODE = "sdk"

SESSIONS: dict[str, list[TranscriptTurn]] = {}


class AgentRequestHandler(BaseHTTPRequestHandler):
    server_version = "TerryGamAgent/0.1"

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json({"ok": True, "service": "terrygam-agent"})
            return
        self._send_json({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        if self.path != "/agent/turn":
            self._send_json({"error": "not found"}, status=404)
            return

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
            self._send_json(response)
        except Exception as error:
            self._send_json({"error": str(error)}, status=500)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[agent] {self.address_string()} - {format % args}")

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

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
