from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import TranscriptTurn

DIARIZE_MODEL = "gpt-4o-transcribe-diarize"
DIARIZE_RESPONSE_FORMAT = "diarized_json"


def transcribe_diarized_audio(
    audio_bytes: bytes,
    *,
    filename: str,
    mime_type: str,
    source: str = "browser_microphone",
) -> tuple[list[TranscriptTurn], dict[str, Any]]:
    if not audio_bytes:
        raise ValueError("audio payload is empty")

    from openai import OpenAI

    client = OpenAI()
    upload_name = filename or f"audio{_suffix_for(filename, mime_type)}"
    response = client.audio.transcriptions.create(
        model=DIARIZE_MODEL,
        file=(upload_name, audio_bytes, mime_type),
        response_format=DIARIZE_RESPONSE_FORMAT,
    )

    payload = _response_to_dict(response)
    turns = _turns_from_diarized_payload(payload, source=source)
    return turns, payload


def _response_to_dict(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    if hasattr(response, "model_dump"):
        return response.model_dump()
    if hasattr(response, "model_dump_json"):
        return json.loads(response.model_dump_json())
    if hasattr(response, "dict"):
        return response.dict()
    return {"text": str(response)}


def _turns_from_diarized_payload(payload: dict[str, Any], *, source: str) -> list[TranscriptTurn]:
    segments = payload.get("segments") or []
    turns: list[TranscriptTurn] = []

    for index, segment in enumerate(segments):
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        speaker = str(segment.get("speaker") or segment.get("speaker_label") or f"speaker_{index + 1}")
        turns.append(
            TranscriptTurn(
                speaker=speaker,
                text=text,
                source=source,  # type: ignore[arg-type]
                confidence=float(segment.get("confidence") or 0.9),
            )
        )

    if turns:
        return turns

    text = str(payload.get("text") or "").strip()
    if not text:
        return []

    return [
        TranscriptTurn(
            speaker="speaker_unknown",
            text=text,
            source=source,  # type: ignore[arg-type]
            confidence=0.7,
        )
    ]


def _suffix_for(filename: str, mime_type: str) -> str:
    suffix = Path(filename).suffix
    if suffix:
        return suffix
    if "webm" in mime_type:
        return ".webm"
    if "mp4" in mime_type or "mpeg" in mime_type:
        return ".mp4"
    if "wav" in mime_type:
        return ".wav"
    return ".audio"
