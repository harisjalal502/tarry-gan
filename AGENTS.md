# Agent Notes

## Product North Star

TerryGam is the physical context layer for small startup teams. The robot is not a gimmick; it is the body that lets the product capture context that never enters digital systems.

## Build Priorities

1. Preserve the hackathon demo spine.
2. Prefer reusable infrastructure over rebuilding media/control stacks from scratch.
3. Keep robot-specific code behind adapters so the dashboard and memory pipeline can run in demo/replay mode.
4. Make observability visible in the UI: if Reachy sees a face, hears speech, detects a whiteboard, or writes memory, the user should see that state.
5. Maintain a fallback path for every live hardware dependency.
6. For dependencies we may actually use, inspect local source clones before relying on web-search summaries.

## Technical Assumptions From Prior Prototype

- The Reachy Mini desktop app exposes a local daemon around `127.0.0.1:8000`.
- The desktop app also proxies camera/WebRTC signaling around `127.0.0.1:8443`.
- Browser-based access to the robot camera via the desktop app proxy is more reliable than direct LAN access to the robot IP.
- Robot motion can be tested independently from voice/camera before debugging the full realtime loop.
- OpenAI realtime, robot speaker output, browser mic, and robot camera are separate integration layers and should be verified separately.
- GBrain source inspection lives in `docs/gbrain-source-research.md`.

## Decision Style

When implementation choices have demo or architectural consequences, stop and explain the options briefly. When the change is mechanical and reversible, implement it directly.
