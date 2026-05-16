# Modes And Technical Difficulty

## Operating Modes

### Demo Replay Mode

No robot required. Uses prerecorded transcript, frames, and events. This mode protects the hackathon demo.

Difficulty: easy.

### Live Dashboard Mode

Dashboard runs with live or replayed input and shows the event stream, detections, and memory writes.

Difficulty: easy to medium.

### Live Robot Presence Mode

Reachy Mini moves, looks between detected faces, and optionally speaks. The robot body makes the demo feel real even before every modality is perfect.

Difficulty: medium.

### Live Robot Camera Mode

Dashboard receives Reachy Mini camera frames through the desktop app/local proxy and overlays detections.

Difficulty: medium.

### Full Ambient Capture Mode

Robot camera, audio transcription, face/speaker tracking, whiteboard context, GBrain memory writes, and retrieval all run together.

Difficulty: hard.

## Technical Difficulty Map

### Easy

- Static dashboard with event timeline.
- Replay mode with seeded founder debate.
- Structured event schema.
- GBrain query demo using seeded memory.
- Manual "write memory" button for early testing.

### Medium

- Face detection on camera frames.
- Reachy head movement based on detected faces.
- Robot speaker output.
- Browser mic or local machine mic transcription.
- Live context-card extraction from transcript.
- GBrain ingestion adapter once the repo/CLI behavior is confirmed.

### Hard

- Direct robot microphone input, if exposed at all.
- Robust direct robot camera without the desktop app proxy.
- Speaker diarization in a noisy room.
- Whiteboard OCR that works in poor lighting.
- Multi-person gaze/attention tracking.
- End-to-end realtime voice plus motion plus memory without race conditions.

## Demo-Critical Versus Nice-To-Have

Demo-critical:

- Under-two-minute story.
- Reachy visible and moving.
- Dashboard showing robot-camera brain view.
- At least one real perception overlay, preferably face boxes.
- Transcript-to-context-card extraction.
- Memory retrieval that clearly uses earlier physical context.
- Product-general labels: detected people, room artifacts, audio, vision, and reactions rather than hardcoded demo characters.

Nice-to-have:

- Direct robot mic.
- Perfect whiteboard OCR.
- Full speaker diarization.
- Production-grade GBrain sync.
- Long-term personal/team knowledge ingestion.
- Reactive emotion gestures when the system detects insight, disagreement, confusion, or decision moments.
- Full talk-back from the robot.

## Fallback Rules

- If robot camera fails, use replayed camera video but keep the same UI.
- If transcription fails, use typed or replayed transcript.
- If GBrain ingestion fails, write JSONL events and replay retrieval with a clearly separated adapter.
- If robot motion fails, show the dashboard and explain the robot adapter status.
