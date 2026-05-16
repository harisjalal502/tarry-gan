# GUI Handoff

This repo is the Tarry/TerryGam hackathon prototype: a Reachy Mini-powered physical context layer that captures room audio/vision, extracts context, and writes memories to GBrain.

## Repo

Local repo path:

```bash
/Users/harisjalal/Desktop/Work/Hackathon GBrain
```

Current branch:

```bash
main
```

No git remote is configured yet. If this needs to be shared through GitHub, add a remote and push:

```bash
git remote add origin <repo-url>
git push -u origin main
```

## Run It

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

Verify before making UI changes:

```bash
npm run verify
node --check apps/dashboard/app.js
```

## What The GUI Owns

The GUI is intentionally simple and lives here:

- `apps/dashboard/index.html`
- `apps/dashboard/styles.css`
- `apps/dashboard/app.js`

It should make the demo legible:

- Robot/camera panel with face boxes.
- Transcript panel with diarized speaker turns.
- Context cards for decisions, risks, questions, follow-ups, and insights.
- Memory ledger showing real GBrain write status.
- Retrieval/meeting-prep panel.

## Do Not Break These Contracts

Do not rename these element IDs unless you update `apps/dashboard/app.js`:

- `reachyButton`
- `liveButton`
- `stopLiveButton`
- `micButton`
- `stopMicButton`
- `agentInputForm`
- `agentTextInput`
- `agentStatus`
- `cameraVideo`
- `faceOverlay`
- `cameraStatus`
- `visionReadout`
- `transcriptStatus`
- `contextStatus`
- `memoryStatus`
- `transcript`
- `contextCards`
- `memoryLedger`
- `answer`
- `gaze`
- `reaction`

Do not change these backend URLs unless the Python server changes too:

```js
http://127.0.0.1:8787/agent/turn
http://127.0.0.1:8787/agent/audio-turn
```

Do not replace the diarized mic flow with browser `SpeechRecognition`. The current important path is:

```text
MediaRecorder audio chunk -> /agent/audio-turn -> OpenAI gpt-4o-transcribe-diarize -> agent -> GBrain write
```

## API Contract

### Health

```bash
curl http://127.0.0.1:8787/health
```

Response includes:

```json
{
  "ok": true,
  "service": "terrygam-agent",
  "diarize_model": "gpt-4o-transcribe-diarize"
}
```

### Text Fallback

```http
POST /agent/turn
Content-Type: application/json
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

### Diarized Audio

```http
POST /agent/audio-turn
Content-Type: multipart/form-data
```

Fields:

- `session_id`
- `source`, usually `browser_microphone`
- `mode`, usually `sdk`
- `file`, the audio blob from `MediaRecorder`

Important response fields:

- `events`: transcript/context events for the dashboard.
- `tool_intents`: agent tool decisions such as `save_memory`.
- `transcription`: model and segment count.
- `memory_write`: real GBrain/local fallback write status.

Expected `memory_write.status` values:

- `gbrain_written`: primary path succeeded.
- `local_fallback_written`: local brain files were written, but GBrain put failed.

## Current Known UI Issues

These are acceptable hackathon todos unless explicitly assigned:

- Transcript chunks can duplicate because the backend returns accumulated session events.
- Diarized speaker labels are `A/B/C`, not stable real names.
- Speaker identity calibration is not implemented.
- Robot motion/reaction tool intents are not yet connected to physical Reachy actions.

## Product Guardrails

Make it look like a product, not a debug console. The user should understand this story in under two minutes:

```text
The room conversation happened.
Tarry heard/saw it.
Tarry extracted useful context.
Tarry wrote it to GBrain.
Later, Tarry can retrieve it for prep.
```

The memory ledger should clearly distinguish:

- Agent intent: "the agent decided to save memory."
- Real memory write: `gbrain_written`.

Do not hide status. If camera, mic, agent, or GBrain is waiting/failing, show it clearly.

## Commit Hygiene

Before handing work back:

```bash
npm run verify
node --check apps/dashboard/app.js
git status --short
```

Do not commit `.env.local`, `.venv/`, `.gbrain/`, or `.gbrain-home/`.
