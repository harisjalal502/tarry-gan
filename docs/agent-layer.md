# Agent Layer

## Current Status

The agent layer is not fully implemented yet.

What exists today:

- Replay events that simulate agent-extracted context.
- Browser/laptop live face detection.
- Reachy camera WebRTC path wired to the Reachy Mini Control local proxy, pending robot availability.
- Debounced live `vision_observation` entries in the dashboard memory ledger.
- GBrain source/write/search smoke tests with ZeroEntropy semantic retrieval.

What does not exist yet:

- Browser microphone capture.
- OpenAI `gpt-4o-transcribe-diarize` integration.
- Live LLM context extraction.
- Tool-routing agent that decides when Reachy should look, react, speak, or save memory.
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

## Next Build Slice

Build browser microphone recording first. Then wire completed chunks into the diarized transcription provider.

This is the right next step because it creates the first real audio -> transcript -> context -> memory path without depending on Reachy being connected.
