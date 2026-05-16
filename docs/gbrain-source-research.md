# GBrain Source Research

Local source inspected:

- Repo: `https://github.com/garrytan/gbrain`
- Local clone: `/tmp/terrygam-research/gbrain`
- Commit inspected: `3933eb6`
- Version inspected: `0.35.1.0`

## What GBrain Actually Is

GBrain is not just a vector store. It is a personal/team knowledge brain with:

- PGLite or Postgres storage.
- Markdown-facing brain pages.
- Hybrid search.
- Sources for multiple logical brains/repos.
- Typed links and timelines.
- Graph traversal.
- MCP server support.
- Code indexing and symbol lookup.
- Skill-driven ingestion workflows.

The practical implication for Tarry is that we should not build our own durable memory/search layer first. We should convert robot observations into GBrain-compatible pages/events and let GBrain handle retrieval, indexing, and graph structure.

## Install Facts

The canonical install path is still:

```bash
git clone https://github.com/garrytan/gbrain.git ~/gbrain
cd ~/gbrain
bun install
bun link
gbrain init
gbrain doctor --json
```

Do not use global Bun/npm package install for `gbrain`. The repo explicitly warns that registry/global installs can install the wrong package or skip required postinstall behavior.

## Relevant Commands

Important commands for this project:

```bash
gbrain sources add <id> --path <path> [--name <display>] [--federated|--no-federated]
gbrain sources list --json
gbrain sync --repo <path>
gbrain import <path>
gbrain embed --stale
gbrain search "term"
gbrain query "question"
gbrain get <slug>
gbrain graph-query <slug> --depth 2
gbrain code-def <symbol> --json
gbrain code-refs <symbol> --json
gbrain code-callers <symbol> --json
gbrain code-callees <symbol> --json
```

## Source Model

GBrain has a `sources` concept. A source is a logical brain within the DB. This matters because Tarry can be its own source instead of polluting another personal/company brain.

Proposed source:

```bash
gbrain sources add tarry-office --path ./brain --name "Tarry Office" --federated
```

For the hackathon, we can keep the brain repo inside this project at `brain/` or use a separate local path. If we want clean product/research separation, use a separate path and keep this repo focused on app code.

## Mapping Tarry To GBrain

Tarry should emit physical-context events, then a memory adapter should write them into GBrain pages.

Suggested mapping:

- Founder debate transcript → `meetings/YYYY-MM-DD-<topic>.md`
- Speaker/person observations → `people/<person>.md` timeline entries when identity is known.
- Whiteboard observation → meeting page section plus possible `ideas/`, `projects/`, or `concepts/` page.
- Verbatim voice note → use the `voice-note-ingest` pattern, preserving exact wording.
- Decision/risk/action item → meeting page structured sections and timeline entries on related entities.
- Codebase context → `gbrain sources add <repo> --path <repo>` plus code indexing commands.

## Skills That Matter

The most relevant GBrain skills/patterns are:

- `meeting-ingestion`: creates meeting pages, attendee enrichment, entity propagation, timeline merge, backlinks.
- `voice-note-ingest`: preserves exact phrasing from audio and routes to the right brain directory.
- `brain-agent-loop`: detect, read, respond, write, sync.
- `brain-first-lookup`: search GBrain before external APIs.
- `query`: retrieval with synthesis.
- `enrich`: person/company enrichment.

## What We Need To Build

GBrain does not give us the robot/perception stack. We still need:

- Reachy Mini camera/audio/motion adapters.
- Face detection and tracking.
- Whiteboard/interface detection.
- Transcript capture.
- A physical-context event schema.
- A dashboard showing the robot's perception and memory writes.
- A GBrain adapter that writes the right pages/events.

## OpenClaw Integration Signal

The GBrain repo includes `openclaw.plugin.json` and OpenClaw extension metadata in `package.json`, so OpenClaw is a supported host/plugin path. That does not mean Tarry needs OpenClaw now. It means if we later want a multi-channel assistant shell, GBrain already knows how to plug into OpenClaw.

## Product Decision

For the MVP, use GBrain directly from our app/adapter. Do not put Hermes or OpenClaw in the critical path.

Later, if the product needs Slack/Telegram/always-on assistant behavior, evaluate Hermes or OpenClaw as an outer agent shell around Tarry.

