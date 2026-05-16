# Build Backlog

## Phase 1 - Demo Spine

1. Create the repo skeleton and product docs.
2. Build a minimal dashboard shell with panes for camera, transcript, context cards, memory writes, and retrieval.
3. Define the physical-context event schema.
4. Add replay mode with a seeded founder-pricing debate.
5. Add a fake memory adapter so the demo flow can work before GBrain is wired.

## Phase 2 - Real Perception

1. Add local face detection against camera/replay frames. Initial browser-camera MediaPipe implementation is in place.
2. Draw bounding boxes in the dashboard. Initial live overlay is in place.
3. Add simple person-target selection: left detected person, right detected person, current speaker.
4. Connect Reachy head movement to target selection.
5. Add visible status for camera, motion, audio, and memory.
6. Add transcript provider interface and replay speaker-separated transcript. Completed as the first pipeline seam.
7. Add diarized chunk transcription for memory writes. Completed with browser `MediaRecorder` chunks sent to OpenAI `gpt-4o-transcribe-diarize`.

## Phase 3 - GBrain/GMemory

1. Use the local GBrain source notes in `docs/gbrain-source-research.md`.
2. Create a `brain/` source or separate local brain path for Tarry office context.
3. Implement a memory adapter around the GBrain CLI first.
4. Map replay events into GBrain-style meeting pages, voice-note pages, decisions, risks, and whiteboard observations.
5. Run `gbrain sources add tarry-office --path <brain-path> --federated`.
6. Run `gbrain sync`, `gbrain embed --stale`, and `gbrain query` against the generated physical-context pages.
7. Compare GBrain against Hermes/OpenClaw memory patterns without installing those platforms unless they become demo-critical.

## Phase 4 - Live Robot Modalities

1. Reuse Reachy Mini desktop app local daemon/proxy for camera.
2. Reuse Reachy SDK/daemon for motion. Initial adapter contract is wired with `mock`, `simulation`, and gated `hardware` modes.
3. Use robot speaker output if available.
4. Prefer browser/local-machine mic first if direct robot mic remains unreliable.
5. Investigate direct robot mic only after the rest of the demo works.
6. Wire the dashboard to the GPT-Realtime-2 WebRTC contract in `docs/realtime-2-pipeline.md`.
7. Handle Realtime function-call events client-side and route them through `/realtime/tool-call`.

## Phase 5 - Whiteboard And Room Context

1. Detect whiteboard/interface regions.
2. Add OCR or image-summary pipeline.
3. Convert whiteboard observations into memory events.
4. Show whiteboard context cards in the dashboard.

## Plus Ideas

These are valuable if time permits, but they should not block the core demo:

1. Insight reaction: when the system detects a strong insight or decision, Reachy does a small positive reaction.
2. Confusion reaction: when the transcript has unresolved disagreement, Reachy does a curious/tilted-head reaction.
3. Attention sweep: Reachy periodically looks around to detect whiteboards, screens, and room state.
4. Talk-back: Reachy speaks a short response from the robot speaker.
5. Transcript polish: dedupe repeated chunk history in the dashboard and add speaker calibration so diarized labels `A/B/C` map to real names.

For hackathon priority, silent realtime tool routing is core. Full talk-back is plus-plus and should stay behind an explicit toggle.

## Immediate Next Build Target

Wire the dashboard to the GPT-Realtime-2 backend contract. The backend can now create tool-only Realtime sessions and route function calls to Reachy/GBrain; the next product step is making the browser WebRTC loop listen, transcribe, call tools, and show those events.
