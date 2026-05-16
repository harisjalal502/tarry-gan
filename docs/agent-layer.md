# Agent Layer

## Current Status

The agent layer is not fully implemented yet.

What exists today:

- Replay events that simulate agent-extracted context.
- Browser/laptop live face detection.
- Reachy camera WebRTC path wired to the Reachy Mini Control local proxy, pending robot availability.
- Debounced live `vision_observation` entries in the dashboard memory ledger.
- GBrain source/write/search smoke tests with ZeroEntropy semantic retrieval.
- A Python agent package at `apps/agent/` with an OpenAI Agents SDK adapter and deterministic local smoke mode.
- Browser microphone chunks routed through OpenAI `gpt-4o-transcribe-diarize` before they enter the agent loop.

What does not exist yet:

- Robot microphone capture.
- Known-speaker enrollment and stable real-name identity mapping.
- Tool-routing agent connected to real Reachy and GBrain side effects.
- Agent chat backed by live GBrain retrieval.

## Role In The Product

The agent layer sits between physical signals and memory. It decides what matters.

GBrain answers: "Where is the memory and how do we retrieve it?"

The agent answers: "What should become memory, what action should the robot take, and what should we tell the team?"

## MVP Agent Loop

1. Capture a short audio chunk from the browser microphone.
2. Send the chunk to OpenAI `gpt-4o-transcribe-diarize`.
3. Convert speaker-labeled transcript segments into normalized events.
4. Extract context cards such as decisions, risks, follow-ups, open questions, and insights.
5. Write the session summary and extracted events into GBrain.
6. Answer a dashboard query by retrieving from GBrain and synthesizing a concise prep answer.

## Tool Layer

The agent should eventually control these tools:

- `look_at(target)` routes to Reachy movement.
- `react(emotion)` routes to Reachy movement/sound.
- `speak(text)` routes to robot speaker when reliable.
- `save_memory(events)` routes to GBrain.
- `search_memory(query)` routes to GBrain query/search.

For now, robot actions should remain explicit and visible. The dashboard should show what tool the agent would call before we let it act autonomously.

## Current Agent Runtime Decision

Use OpenAI Agents SDK Python for the backend agent loop because Reachy Mini control is Python-first and the robot tools should live close to the hardware adapter. Use GBrain as memory/search tools, not as the main runtime. Use Vercel AI SDK later if the dashboard becomes a full Next.js streaming UI.

The current package supports:

- `auto` mode: try OpenAI Agents SDK, fall back to deterministic local extraction.
- `sdk` mode: require OpenAI Agents SDK and raise if unavailable.
- `local` mode: deterministic extraction for smoke tests and demo-safe fallback.

## Next Build Slice

Build browser microphone recording first. Then wire completed chunks into the diarized transcription provider.

This is the right next step because it creates the first real audio -> transcript -> context -> memory path without depending on Reachy being connected.
