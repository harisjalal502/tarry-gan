# Architecture

## System Shape

Tarry has six layers:

1. Robot layer: Reachy Mini camera, head movement, speaker output, and eventually robot microphone.
2. Perception layer: face detection, speaker tracking, whiteboard detection/OCR, and scene summaries.
3. Event layer: normalized physical-context events with timestamps and source metadata.
4. Agent layer: transcription, context extraction, decision/risk/follow-up synthesis, tool routing, and meeting-prep answers.
5. Memory layer: GBrain/GMemory adapter for writing and retrieving structured context.
6. Interface layer: dashboard, agent chat, and demo/replay controls.

The product has three physical signal layers:

- Vision: frames, faces, whiteboards, screens, objects, and spatial attention.
- Audio: speech, exact phrasing, speaker flow, and conversational signals.
- Embodiment: gaze, reactions, head movement, and eventual robot speech.

## Component Boundaries

### Robot Adapter

Owns all direct Reachy Mini integration.

Expected interfaces:

- `get_camera_frame()`
- `move_head(target)`
- `speak(text)`
- `get_audio_stream()` when robot mic support is available
- `status()`

Initial implementation should reuse the Reachy Mini desktop app daemon/proxy where possible instead of rebuilding WebRTC/media plumbing.

### Perception Pipeline

Consumes frames/audio/transcripts and emits observations.

Candidate detectors:

- Face detection and tracking for "Reachy is looking at a detected person/current speaker".
- Whiteboard/interface detector for "this physical surface matters".
- OCR or image captioning for whiteboard text.
- Speaker diarization if we can get reliable audio.
- Conversational signal detection for insight, disagreement, confusion, decision, and follow-up moments.

### Transcription Pipeline

Use a two-pass pipeline:

- Live pass: low-latency transcript for the dashboard and optional interaction.
- Memory pass: diarized transcript chunks for accurate speaker-separated GBrain writes.

The default MVP provider for memory chunks is OpenAI `gpt-4o-transcribe-diarize`. If live speaker labels become demo-critical, Deepgram is the backup API candidate. Local pyannote/WhisperX is a later privacy/locality path.

See `docs/transcription-speaker-identity.md`.

Current implementation status:

- Replay speaker-separated transcript exists.
- Browser/live microphone capture records 8-second chunks with `MediaRecorder`.
- OpenAI `gpt-4o-transcribe-diarize` is wired through the Python agent service at `/agent/audio-turn`.
- Realtime voice is not required for this layer unless we need low-latency talk-back or live tool calls.

### Event Bus

Every observation becomes a simple event. The event stream is the contract between live robot capture, replay mode, dashboard rendering, and memory ingestion.

Example event:

```json
{
  "type": "decision",
  "source": "conversation",
  "text": "Team agreed to test $99/mo founder pricing first.",
  "confidence": 0.82,
  "timestamp": "2026-05-16T19:15:00-07:00",
  "metadata": {
    "speakers": ["founder_a", "founder_b"],
    "room": "office",
    "session_id": "demo-pricing-debate"
  }
}
```

### Agent Layer

The agent layer is the reasoning/tool layer between raw physical events and durable memory. It should not be confused with GBrain itself. GBrain stores and retrieves memory; the agent decides what to extract, when to write memory, what tool to call, and how to answer questions.

Expected interfaces:

- `transcribe_chunk(audio)` for diarized memory transcripts.
- `extract_context(events, transcript)` for decisions, risks, follow-ups, insights, and whiteboard observations.
- `route_tool(intent)` for robot actions such as look, react, speak, and save memory.
- `answer_with_memory(query)` for meeting/customer/investor prep backed by GBrain retrieval.

Current implementation status:

- OpenAI Agents SDK is wired behind the Python agent service.
- Text and diarized audio turns feed the agent loop.
- The dashboard renders transcript events, context cards, and tool intents.
- Live face detections emit debounced `vision_observation` events, but no LLM has interpreted them yet.
- The next real agent slice is turning `save_memory` tool intents into actual GBrain writes and retrieval answers.

### Memory Adapter

GBrain is the retrieval/search layer. Source inspection shows it is more than vector memory: it has local PGLite/Postgres storage, sources, markdown-facing brain pages, hybrid search, typed links, timelines, graph traversal, MCP, code indexing, and skill-driven ingestion.

Our app-level memory adapter should hide the specific GBrain CLI/API details behind:

- `write_event(event)`
- `search(query, filters)`
- `summarize_session(session_id)`
- `prep_for_meeting(topic)`

For this project, `GMemory` should mean our adapter/domain layer around GBrain-backed memory. It should not be treated as a separate external product unless we later discover a real repo/package with that name.

The likely first source is:

```bash
gbrain sources add tarry-office --path ./brain --name "Tarry Office" --federated
```

Physical-room events should become GBrain-compatible meeting pages, voice-note pages, timeline entries, and typed links.

### Dashboard

The dashboard is Reachy's brain view. It should show what the robot sees, hears, extracts, and remembers.

Minimum panes:

- Robot camera with bounding boxes.
- Live transcript.
- Extracted context cards.
- Memory writes.
- Search/meeting-prep answer panel.

## Reuse Strategy

Use existing infrastructure aggressively when it lowers risk:

- Reachy Mini desktop app for local daemon, proxy, and camera transport.
- Reachy SDK for motion and robot behavior.
- Open source face detection for local visual tracking.
- GBrain for memory/search rather than writing our own vector database.
- OpenAI realtime/audio models for voice interaction when useful.

Do not reuse infrastructure blindly when it hides too much state. Every live integration needs visible status in the dashboard.
