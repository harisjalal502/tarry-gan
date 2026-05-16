# Hermes And OpenClaw Notes

This doc tracks whether Hermes Agent or OpenClaw should become part of TerryGam.

Local source inspected:

- Hermes Agent clone: `/tmp/terrygam-research/hermes-agent`, commit `8a2b2b9`.
- OpenClaw clone: `/tmp/terrygam-research/openclaw`, commit `500d2823`.
- GBrain clone: `/tmp/terrygam-research/gbrain`, commit `3933eb6`.

## Short Answer

Do not set up Hermes or OpenClaw for the first MVP.

They are useful references and possible later integration layers, but they do not solve the core hackathon problem: capture physical office context through Reachy Mini, structure it, store it in GBrain, and retrieve it during meeting prep.

GBrain itself already ships an `openclaw.plugin.json` and OpenClaw extension metadata, so OpenClaw compatibility exists at the GBrain layer. That makes OpenClaw a possible host later, not something we need to wedge into the MVP.

## What They Are

### Hermes Agent

Hermes Agent is a self-hosted/self-improving agent runtime from Nous Research. Its strongest claims are a closed learning loop, agent-curated memory, autonomous skill creation, cross-session search, model routing, messaging gateways, cron scheduling, and subagent delegation.

Relevant source: https://github.com/NousResearch/hermes-agent

### OpenClaw

OpenClaw is a local-first personal AI assistant/control plane. Its core strengths are a gateway daemon, many messaging channels, multi-agent routing, skills, voice wake/talk mode, live canvas, tools, and companion apps.

Relevant sources:

- https://github.com/openclaw/openclaw
- https://openclawdoc.com/

## What They Would Give TerryGam

Hermes could give us:

- A persistent agent shell that learns workflows over time.
- Skill creation/self-improvement patterns to study.
- Scheduled recaps and automations.
- A messaging gateway so the team can talk to TerryGam from Telegram, Slack, etc.
- Another memory architecture to compare against GBrain.

OpenClaw could give us:

- A multi-channel gateway/control plane.
- A skills/plugin distribution model.
- Voice wake/talk-mode ideas.
- A remote operations layer for "message the office companion from anywhere".
- Sandboxing and permission patterns for agents that can act in real systems.

## What They Do Not Give Us

They do not directly give us:

- Reachy Mini camera integration.
- Reachy Mini head movement.
- Reliable robot microphone input.
- Face detection.
- Whiteboard detection/OCR.
- The physical-context event schema.
- The hackathon dashboard.
- A reason to avoid GBrain.

## Relationship To Our Stack

Our stack should stay:

- Reachy Mini: body and sensors.
- Perception pipeline: face, whiteboard, transcript, scene observations.
- Event bus: normalized physical-context events.
- GBrain/GMemory adapter: searchable memory for physical context.
- Dashboard: Reachy's visible brain.
- GStack: coding/agent workflow support.

Hermes/OpenClaw are optional outer shells. If we add one later, it should wrap TerryGam, not replace the product core.

## Decision

For the hackathon, we should borrow ideas, not install another agent platform.

Use Hermes/OpenClaw as design references for:

- Skill/plugin boundaries.
- Agent memory UX.
- Multi-channel assistant surfaces.
- Scheduled office summaries.
- Safety and permission boundaries.

Only set one up if we explicitly decide that the demo needs "talk to TerryGam from Slack/Telegram" or "agent runs continuously as a remote assistant". That is not the current demo-critical path.

## Later Evaluation Questions

- Can GBrain be exposed as a Hermes/OpenClaw skill without duplicating memory?
- Can TerryGam events be routed into an agent gateway cleanly?
- Does either platform provide a better long-running daemon model than our own app?
- Does the extra operational/security complexity help the demo enough to justify it?
- Are their memory abstractions meaningfully better than GBrain for physical-room context?
