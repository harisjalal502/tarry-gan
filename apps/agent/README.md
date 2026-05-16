# TerryGam Agent Service

This package is the backend agent seam for TerryGam.

It is intentionally separate from the dashboard because the robot loop needs to own hardware tools, audio/transcription, and memory writes without coupling those decisions to UI state.

## Runtime Shape

The default smoke path is deterministic and local:

```bash
npm run agent:smoke
```

The production path is OpenAI Agents SDK:

```bash
uv add openai-agents
TERRYGAM_AGENT_MODE=sdk python3 -m apps.agent.terrygam_agent.cli --sample
```

If the SDK is not installed, `auto` mode falls back to the local extractor so repo verification remains stable.

## Tool Boundary

The agent layer owns these tool intents:

- `save_memory` writes extracted room context into GBrain.
- `search_memory` retrieves prior context from GBrain.
- `react` maps insight/risk moments into Reachy reactions.
- `look_at` maps attention targets into Reachy gaze/motion.

The current implementation records tool intents without performing live robot movement or GBrain mutation. That is deliberate: tool calls should become visible in the dashboard before we let them act autonomously.
