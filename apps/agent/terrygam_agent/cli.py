from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime

from .agent import run_agent
from .models import TranscriptTurn

SAMPLE_TURNS = [
    TranscriptTurn(
        speaker="speaker_1",
        text="Let's ship the founder-friendly pricing test this Friday.",
    ),
    TranscriptTurn(
        speaker="speaker_2",
        text="The risk is enterprise trust, so we need to show the security story before investor prep.",
    ),
    TranscriptTurn(
        speaker="speaker_1",
        text="Can TerryGam remember that customer signal for the next pitch?",
    ),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the TerryGam physical-context agent.")
    parser.add_argument("--session-id", default="agent-smoke-session")
    parser.add_argument("--mode", choices=("auto", "local", "sdk"), default="auto")
    parser.add_argument("--sample", action="store_true", help="Run a built-in startup-room sample.")
    parser.add_argument(
        "--jsonl",
        help="Path to JSONL transcript turns with speaker/text fields. Uses stdin when set to '-'.",
    )
    args = parser.parse_args()

    turns = _load_turns(args)
    result = asyncio.run(run_agent(turns, args.session_id, args.mode))
    print(json.dumps(result.to_json(), indent=2))
    return 0


def _load_turns(args: argparse.Namespace) -> list[TranscriptTurn]:
    if args.sample or not args.jsonl:
        return SAMPLE_TURNS

    lines = sys.stdin if args.jsonl == "-" else open(args.jsonl, encoding="utf-8")
    with lines:
        return [
            TranscriptTurn(
                speaker=str(payload.get("speaker", "speaker_unknown")),
                text=str(payload["text"]),
                source=payload.get("source", "browser_microphone"),
                confidence=float(payload.get("confidence", 0.95)),
                timestamp=str(payload.get("timestamp", datetime.now(UTC).isoformat())),
            )
            for payload in (json.loads(line) for line in lines if line.strip())
        ]


if __name__ == "__main__":
    raise SystemExit(main())
