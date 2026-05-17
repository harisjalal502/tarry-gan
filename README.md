# Tarry

Tarry is a physical context layer for startup offices.

Digital tools already remember Slack, Linear, GitHub, docs, and calendars. Tarry remembers what happens in the room: whiteboards, debates, decisions, risks, and the messy physical context that usually disappears.

It runs on Reachy Mini, listens through Realtime, sees through the robot camera, writes a live Scratchpad, and commits durable memory to GBrain.

## Gallery

<p>
  <img src="docs/assets/gallery/tarry-at-yc-hackathon.jpg" width="100%" alt="Tarry at the GStack x GBrain Hackathon sign" />
</p>

### Interface

<p>
  <img src="docs/assets/gallery/tarry-interface.png" width="100%" alt="Tarry interface analyzing a whiteboard through the robot camera" />
</p>

### Tarry At YC

<p>
  <img src="docs/assets/gallery/tarry-with-hackathon-team.jpg" width="32%" alt="Tarry with the hackathon team" />
  <img src="docs/assets/gallery/tarry-team-table-wide.jpg" width="32%" alt="Tarry with team members at the table" />
  <img src="docs/assets/gallery/tarry-team-portrait.jpg" width="32%" alt="Tarry team portrait" />
</p>

### Tarry With Robot Friends

<p>
  <img src="docs/assets/gallery/tarry-office-companion.jpg" width="49%" alt="Tarry beside another robot in the workspace" />
  <img src="docs/assets/gallery/tarry-with-builders.jpg" width="49%" alt="Tarry with builders and robot friends in the office" />
</p>

### Office Companion

<p>
  <img src="docs/assets/gallery/tarry-founder-selfie.jpg" width="32%" alt="Founder selfie with Tarry" />
  <img src="docs/assets/gallery/tarry-demo-room.jpg" width="32%" alt="Tarry in the demo room" />
</p>

### Demo Room

<p>
  <img src="docs/assets/gallery/tarry-stage-mic.jpg" width="32%" alt="Tarry near a demo microphone" />
  <img src="docs/assets/gallery/tarry-projector-room.jpg" width="32%" alt="Tarry near a projector room setup" />
  <img src="docs/assets/gallery/video-whiteboard-discussion-1.jpg" width="32%" alt="Whiteboard discussion clip thumbnail one" />
</p>

## Demo Loop

1. Two founders debate around a whiteboard.
2. Tarry watches and listens.
3. Someone says, "Tarry, capture the whiteboard."
4. Tarry scans the board and writes live notes.
5. The team asks a memory question later.
6. GBrain retrieves the physical-room context.

## What It Does

- Sees the room through Reachy Mini.
- Listens to in-person team conversations.
- Reads messy whiteboards and takes its best guess when the image is blurry.
- Writes live working notes into a Scratchpad.
- Saves important context into GBrain for later retrieval.
- Lets the team ask, "What did we decide?" after the meeting is over.

## Stack

- Reachy Mini for embodiment and robot camera.
- OpenAI Realtime for live audio, image input, and tool calls.
- Tarry Scratchpad for live working notes.
- GBrain for durable memory and retrieval.
- Local dashboard for the demo surface.

## Run

```bash
npm run agent:serve
npm run dashboard
```

Open:

```text
http://127.0.0.1:5173/
```

Then click `Start Tarry` and say:

```text
Tarry, capture the whiteboard.
```

## Status

The current demo path is focused on camera plus Scratchpad. The main screen intentionally stays simple: Robot Camera on the left, Tarry Scratchpad on the right, with debug panels hidden behind a toggle.
