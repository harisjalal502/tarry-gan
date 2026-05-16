# Hackathon Demo Script

Target length: under two minutes.

## Demo Arc

### 0:00-0:15 - Problem

Show two teammates in a room. One says: "All our real decisions happen here, but none of this gets into Slack, docs, or calendar."

Show Reachy Mini on the desk.

Narration: "Tarry is the physical context layer for small teams."

### 0:15-0:45 - Live Capture

The team debates a concrete startup decision, for example pricing or investor positioning.

Reachy turns between speakers. The dashboard shows:

- Live robot camera feed.
- Face bounding boxes labeled as detected people, not hardcoded characters.
- Transcript streaming in.
- Extracted context cards such as `Decision`, `Risk`, `Question`, and `Follow-up`.

### 0:45-1:10 - Whiteboard Context

One founder points to a whiteboard with a simple sketch or bullet list.

The dashboard shows a `Whiteboard detected` event and extracts a few visible keywords or a summary.

The important demo point is not perfect OCR. The important point is that physical-room state becomes structured memory.

### 1:10-1:40 - Retrieval

Later, a teammate asks: "Prep me for the investor meeting. What did we decide about pricing and what risks are unresolved?"

Tarry retrieves the earlier physical context through the memory layer and answers:

- The agreed pricing direction.
- The disagreement or concern.
- The whiteboard note.
- Suggested investor talking points.

### 1:40-2:00 - Close

Show the dashboard timeline and search.

Closing line: "Slack captures the digital office. Tarry captures the room."

## Demo-Safe Fallback

If hardware or realtime capture flakes, use replay mode:

- Replay a prerecorded camera clip.
- Replay a transcript.
- Still show memory writes and GBrain retrieval.
- Keep Reachy doing simple head turns so the physical presence remains real.
