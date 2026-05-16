# GPT-Realtime-2 Pipeline

## Product Role

GPT-Realtime-2 should be the hot loop for live room interaction, not the archive and not the whole app.

For Tarry, the realtime model should behave as a silent tool router:

```text
browser/robot mic + occasional camera snapshots
-> GPT-Realtime-2 session
-> tool calls
-> Reachy movement/reactions + GBrain memory/search
-> dashboard observability
```

It should not be the robot's chatty answer voice by default. The default behavior is: listen, transcribe, notice important moments, call tools, and stay quiet unless the product later enables explicit talk-back.

## Current Backend Contract

The agent service exposes:

```http
GET /realtime/session-config
```

Returns the local GPT-Realtime-2 session config without creating a live OpenAI session. This is for inspection and smoke tests.

```http
POST /realtime/client-secret
```

Payload:

```json
{
  "session_id": "live-room-2026-05-16"
}
```

Creates a short-lived OpenAI Realtime client secret for browser WebRTC connection. The session is configured with:

- `model: gpt-realtime-2`
- text-only output so the model does not speak by default
- input audio transcription enabled
- tool definitions for robot actions and GBrain memory

```http
POST /realtime/tool-call
```

Payload:

```json
{
  "call_id": "call_123",
  "name": "react",
  "arguments": {
    "emotion": "insight"
  }
}
```

Routes Realtime function calls into local Tarry tools and returns output that the browser can send back as a Realtime `function_call_output` item.

## Tools

Realtime can call:

- `look_at(target, reason)` for Reachy attention.
- `react(emotion, reason)` for visible robot feedback.
- `save_memory(session_id, text, event_type, source, tags)` for GBrain-backed physical context.
- `search_memory(query, limit)` for live retrieval.

`save_memory` writes to `brain/live-sessions/<session>-realtime.md`, appends raw events under `brain/sources/physical-room/`, and tries `gbrain put` with local fallback.

## Transcription

Realtime transcription is enabled inside the GPT-Realtime-2 session through `audio.input.transcription`.

This is the live transcript path:

```text
microphone audio
-> Realtime session
-> conversation.item.input_audio_transcription.* events
-> dashboard transcript
-> selected durable moments saved via save_memory
```

The existing `gpt-4o-transcribe-diarize` chunk path should remain as the slower archival memory pass when speaker labels matter.

## Images And Whiteboard

GPT-Realtime-2 supports image input, but not continuous video ingestion. The right design is periodic or event-triggered snapshots:

```text
Reachy camera frame
-> frontend snapshot as input_image
-> GPT-Realtime-2 sees current room/whiteboard
-> save_memory(event_type="whiteboard_observation")
-> GBrain
```

Local face detection should still run for fast bounding boxes and gaze targeting. The model should receive images only when something changed or when the user asks what the robot sees.

## Frontend Responsibilities

The browser should:

1. Request `/realtime/client-secret`.
2. Connect to OpenAI Realtime with WebRTC using the returned ephemeral key.
3. Stream microphone audio.
4. Listen for live transcript events and render them.
5. Listen for function-call events.
6. POST function calls to `/realtime/tool-call`.
7. Send the tool output back to Realtime as `function_call_output`.
8. Send `input_image` snapshots from the active camera when useful.

## Open Decisions

- Whether talk-back stays off for the demo or becomes an explicit toggle.
- How often to send camera snapshots: time-based, face-count-change-based, or user-triggered.
- Whether live transcript uses generic speaker labels or remains unassigned until the slower diarized pass.
