# Tarry Office Context Layer

Tarry is a Reachy Mini-powered physical context layer for small teams. Digital tools capture Slack, docs, GitHub, and calendar. Tarry captures what normally disappears from the office: debates, whiteboard changes, customer-call prep, verbal decisions, room signals, and physical context.

The hackathon goal is a compelling under-two-minute demo where Reachy Mini listens, looks around, tracks people/whiteboards, stores structured context through GBrain, and later helps the team prepare using memories from the physical room.

## Demo Thesis

Small teams lose their most important context in the room.

Tarry turns the office into searchable memory.

## MVP Loop

1. A small team discusses a live decision in the office.
2. Reachy Mini listens, looks, and reacts to the room.
3. The dashboard shows Reachy's brain: camera view, face boxes, room/context detections, transcript, and extracted decisions.
4. The app writes structured physical-context events into the memory layer.
5. Later, a teammate asks for investor/customer prep and Tarry retrieves the relevant context through GBrain.

## Physical Layers

Tarry adds three physical layers that normal digital context tools miss:

- Vision: images, people, whiteboards, screens, objects, and spatial attention.
- Audio: spoken discussion, interruptions, emphasis, and exact phrasing.
- Embodiment: gaze, head movement, reactions, and ambient feedback that make the capture layer legible in the room.

## Repo Structure

- `docs/product.md` defines the product story, users, and demo promise.
- `docs/demo-script.md` defines the hackathon video/demo spine.
- `docs/architecture.md` defines the system boundaries and component interfaces.
- `docs/agent-layer.md` defines the current and intended agent/tool layer.
- `docs/modes.md` defines operating modes, technical difficulty, and fallback paths.
- `docs/agent-platforms.md` explains Hermes/OpenClaw and why they are optional for now.
- `docs/gbrain-source-research.md` captures source-backed GBrain findings from a local clone.
- `docs/transcription-speaker-identity.md` defines the transcript, diarization, and speaker identity plan.
- `docs/retrieval-embeddings.md` records the ZeroEntropy embedding decision for GBrain.
- `docs/backlog.md` defines the next build steps in priority order.
- `AGENTS.md` gives future coding agents the project rules and context.

## Current Build State

This repo is intentionally starting clean. We are carrying forward the learnings from the previous Reachy Mini prototype, especially:

- Reuse the Reachy Mini desktop app/local daemon/proxy where possible instead of rebuilding media infrastructure.
- Treat GStack as the agent workflow/dev layer.
- Treat GBrain as the memory/search layer.
- Keep a demo-safe fallback mode so the hackathon does not depend on perfect robot/network behavior.

## Local Testing

Run the replay dashboard:

```bash
npm run dashboard
```

In the dashboard, click `Start Laptop Vision` to open the browser camera and run the MediaPipe face detector. Click `Start Reachy Camera` to try the Reachy Mini desktop app's local WebRTC proxy. Live detections draw bounding boxes and emit debounced `vision_observation` entries into the dashboard memory ledger. The next adapter swap is making the Reachy camera path reliable whenever the robot daemon is online.

Inspect the physical-context pipeline:

```bash
npm run pipeline:inspect
```

Test GBrain page write + retrieval:

```bash
npm run gbrain:test
```

If `ZEROENTROPY_API_KEY` is set, the GBrain test also verifies semantic retrieval. Without it, the test verifies source registration, page read, and keyword search.

This repo uses a project-local GBrain home at `.gbrain-home/` so hackathon retrieval settings do not mutate your global `~/.gbrain` database.
