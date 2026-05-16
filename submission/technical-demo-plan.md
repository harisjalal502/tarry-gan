# Technical Demo Plan

## Locked Decisions

- Setting: real office.
- Name: Tarry.
- Main proof: robot sees people and reacts/moves.
- Camera: any live camera is acceptable for the first working demo; Reachy camera remains the target adapter.
- Audio: browser or laptop mic is acceptable for v1.
- Deadline posture: optimize for momentum, not perfection.

## Demo-Critical

1. Dashboard loads reliably.
2. Live camera path shows real people.
3. Face/person boxes appear over the camera view.
4. Reachy does at least one visible movement or reaction.
5. Context cards and memory writes appear.
6. GBrain retrieval answers a meeting-prep question from captured context.

## Demo-Helpful

1. Browser mic transcript.
2. Speaker-ish labels such as "current speaker" or "speaker turn", even if not identity-perfect.
3. Whiteboard context card from a visible sketch or manual seeded event.
4. Robot attention state shown in dashboard.

## Not Required For First Video

1. Perfect robot camera path.
2. Perfect robot microphone path.
3. Full talk-back from robot speaker.
4. Production-grade diarization.
5. Fully automated whiteboard OCR.

## Next Engineering Step

Build the real vision slice:

1. Confirm laptop/browser camera path in the dashboard.
2. Render real face/person boxes.
3. Convert detections into normalized events.
4. Add a "trigger robot reaction" path from a detection or context-card event.
5. Keep Reachy camera as the next adapter target.
