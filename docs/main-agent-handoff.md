# Main Agent Handoff

This document is the handoff for the next main agent. Treat the code as source of truth, and use this file only as a map of intent and current state.

## Current Branch And Remote

The active branch is `main`.

Remote:

```text
https://github.com/harisjalal502/tarry-gan.git
```

Main now includes the previously separate retrieval and Reachy adapter work.

## Product Intent

Tarry is the physical context layer for small teams. The demo story is:

```text
People talk in a room.
Reachy/Tarry captures audio and vision.
The agent extracts decisions, risks, questions, and follow-ups.
The system writes physical-room context to GBrain.
Later, a teammate asks a prep question and Tarry retrieves the room memory.
Reachy can react or move as a visible embodied companion.
```

## Source-Of-Truth Files

Read these first:

- `README.md` for the overall product and run commands.
- `AGENTS.md` for agent rules and prior Reachy assumptions.
- `docs/architecture.md` for system boundaries.
- `docs/backlog.md` for remaining work.
- `docs/gui-handoff.md` for dashboard/API contracts.
- `docs/transcription-speaker-identity.md` for diarized transcription decisions.
- `apps/agent/terrygam_agent/server.py` for HTTP endpoints.
- `apps/agent/terrygam_agent/memory.py` for GBrain write/search behavior.
- `apps/agent/terrygam_agent/realtime.py` for GPT-Realtime-2 session/tool config.
- `apps/agent/terrygam_agent/robot.py` for Reachy adapter behavior.
- `apps/dashboard/app.js` for current dashboard integration.
- `docs/realtime-2-pipeline.md` for the Realtime-2 product contract.

## Current Capabilities

### Audio And Agent

- Browser records 8-second audio chunks with `MediaRecorder`.
- Chunks are sent to `POST /agent/audio-turn`.
- Backend calls OpenAI `gpt-4o-transcribe-diarize`.
- Diarized turns enter the OpenAI Agents SDK loop.
- Agent emits context events and tool intents.

### Memory

- `save_memory` tool intents write live session markdown under `brain/live-sessions/`.
- Raw event ledgers are written under `brain/sources/physical-room/`.
- Backend tries `gbrain put` into source `tarry-office`.
- If GBrain fails, local files still exist as a demo-safe fallback.
- `POST /agent/query-memory` searches GBrain first, then falls back to local markdown search.

### Reachy

- Robot adapter supports safe modes:
  - `TERRYGAM_ROBOT_MODE=mock` default.
  - `TERRYGAM_ROBOT_MODE=simulation`.
  - `TERRYGAM_ROBOT_MODE=hardware`, gated by `TERRYGAM_ROBOT_ALLOW_MOTION=1`.
- Endpoints:
  - `GET /robot/status`
  - `POST /robot/look-at`
  - `POST /robot/react`
  - `POST /robot/speak`
  - `POST /robot/stop`
- Agent `react` and `look_at` intents dispatch through the robot adapter.
- Robot speech is not wired yet.

### GPT-Realtime-2

- Backend exposes `GET /realtime/session-config` for inspectable session config.
- Backend exposes `POST /realtime/client-secret` to create a browser WebRTC client secret.
- Backend exposes `POST /realtime/tool-call` to route Realtime function calls into Tarry tools.
- The Realtime session is intentionally text-only output and tool-first. It should transcribe, call `look_at`, `react`, `save_memory`, and `search_memory`, and avoid speaking by default.
- Live input transcription is enabled in the session config. The slower `gpt-4o-transcribe-diarize` path remains the archival speaker-labeled pass.

### Dashboard

- Current dashboard is static HTML/CSS/JS in `apps/dashboard/`.
- It displays transcript, context cards, GBrain writes, robot actions, camera/vision, and retrieval answer text.
- UI polish may be happening separately. Avoid large layout changes unless asked.

## Run Commands

Use two terminals:

```bash
npm run agent:serve
```

```bash
npm run dashboard
```

Open:

```text
http://127.0.0.1:5173/
```

Verify:

```bash
npm run verify
npm run memory:query-smoke
```

Optional:

```bash
npm run gbrain:test
npm run robot:smoke
npm run realtime:smoke
```

## API Contracts

### Text Turn

```http
POST /agent/turn
```

Payload:

```json
{
  "session_id": "live-room-2026-05-16",
  "speaker": "A",
  "text": "We should test founder pricing first. The risk is enterprise trust.",
  "source": "manual",
  "mode": "sdk"
}
```

### Diarized Audio Turn

```http
POST /agent/audio-turn
Content-Type: multipart/form-data
```

Fields:

- `session_id`
- `source`
- `mode`
- `file`

### Query Memory

```http
POST /agent/query-memory
```

Payload:

```json
{
  "query": "Prep me for the investor meeting. What did we decide about pricing and what risks are unresolved?",
  "source": "tarry-office",
  "limit": 5
}
```

Expected response:

```json
{
  "mode": "gbrain",
  "answer": "...",
  "matches": []
}
```

`mode` may be `local_fallback` if GBrain fails or returns no results.

### Realtime Client Secret

```http
POST /realtime/client-secret
```

Payload:

```json
{
  "session_id": "live-room-2026-05-16"
}
```

### Realtime Tool Call

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

The response `output` should be sent back to the Realtime session as a function-call output.

## What Is Left

Highest priority:

1. Wire the browser to `/realtime/client-secret` using WebRTC and render realtime transcription events.
2. Handle Realtime function calls client-side, POST them to `/realtime/tool-call`, and send function-call outputs back to the Realtime session.
3. Send event-triggered camera snapshots as `input_image` so whiteboard/room observations can become `save_memory` calls.
4. Validate Reachy simulation mode against the running Reachy daemon.
5. Validate physical hardware mode only when the robot is safe, stable, and `TERRYGAM_ROBOT_ALLOW_MOTION=1` is intentionally set.

Good hackathon polish if time:

1. Deduplicate repeated transcript chunks in the dashboard.
2. Add speaker calibration so `A/B/C` can map to real names.
3. Improve retrieval answer synthesis beyond snippet-based summaries.
4. Wire robot reaction moments more visibly into the UI.
5. Add whiteboard/interface detection or a demo-safe whiteboard observation path.

Do not block on:

- Robot microphone.
- Robot speaker/talk-back.
- Perfect diarization.
- Full local/private transcription.

## Known Risks

- GBrain CLI can be slow or occasionally noisy; keep the local fallback.
- Diarization separates speaker clusters but does not know real names.
- Dashboard currently receives accumulated events, which can create duplicate transcript display.
- Hardware motion must stay safety-gated.

## Latest Verification

After merging retrieval/Reachy work into main:

```bash
npm run verify
npm run memory:query-smoke
```

Both passed.
