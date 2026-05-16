# Transcription And Speaker Identity

Research date: 2026-05-16.

Local source inspected:

- `pyannote.audio`: `/tmp/terrygam-research/pyannote-audio`, commit `78c0d16`.
- `WhisperX`: `/tmp/terrygam-research/whisperX`, commit `1c4b23e`.

External docs checked:

- OpenAI Speech-to-text docs: `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `gpt-4o-transcribe-diarize`.
- Deepgram diarization docs.
- AssemblyAI speaker diarization docs.
- Wispr Flow public site.

## The Product Requirement

Tarry needs a transcript that can separate people in the room. The dashboard should show:

- What was said.
- Who said it, at least as `Person 1`, `Person 2`, etc.
- What context cards were extracted from each person's contribution.
- Which detected face or room artifact Reachy is attending to.

## Key Distinction

Live transcription and speaker-aware memory are different jobs.

- Live transcription optimizes for latency and interaction.
- Diarized transcription optimizes for accurate "who said what" memory.

For the hackathon, we should support both with a two-pass pipeline.

## Recommended MVP Pipeline

### Pass 1: Live Transcript

Use realtime or streaming transcription to show immediate text in the dashboard.

This can run without perfect diarization. It gives the product a sense of liveness.

### Pass 2: Diarized Memory Transcript

Record rolling audio chunks and send completed chunks through a diarization-capable transcription path. Use that output for GBrain memory writes.

The memory transcript should look like:

```text
Person 1 [00:04-00:11]: If we pitch this as a team memory product...
Person 2 [00:13-00:20]: I like $99 a month, but enterprise buyers...
```

Then convert it into:

- Meeting page sections.
- Decisions.
- Risks.
- Questions.
- Follow-ups.
- Person timeline entries when identity is known.

## Provider Decision

### Default For MVP Memory Pass: OpenAI `gpt-4o-transcribe-diarize`

Use this for completed chunks and memory writes.

Reasons:

- We already have OpenAI credentials in the project flow.
- It is the current OpenAI transcription model documented specifically for built-in speaker diarization.
- It returns speaker-aware segments via `diarized_json`.
- It supports optional known speaker reference clips, which gives us a simple identity calibration path.
- It keeps the MVP stack smaller than adding another vendor immediately.

Constraint:

- It is not the newest/best OpenAI realtime voice model. That is a different model family.
- It is available through the transcription endpoint, not the Realtime API. So it is not the single solution for live conversational turn-taking.
- For realtime voice interaction, use the realtime model family, currently `gpt-realtime-2` for the most capable realtime voice loop.

### If We Need Live Speaker Labels: Deepgram

Deepgram supports diarization in both pre-recorded and live streaming modes, returning speaker IDs on words/utterances. If live speaker labels become demo-critical, this is the strongest API candidate to add.

Tradeoff:

- Adds another vendor/API key.

### If We Need Async Meeting-Style Processing: AssemblyAI

AssemblyAI supports speaker labels and speaker identification against known names/roles. It is a good candidate for post-meeting processing.

Tradeoff:

- Less attractive for our immediate live robot loop unless we design around async jobs.

### Local/Open Source Path: pyannote.audio Or WhisperX

`pyannote.audio` is the open-source diarization toolkit. `WhisperX` combines ASR, word alignment, and pyannote-based diarization.

Use this later if we want a more local/private path.

Tradeoffs:

- Requires model downloads and usually a Hugging Face token/user-condition acceptance.
- CPU-only performance on a Mac may be too slow for a hackathon live demo.
- WhisperX itself notes diarization is not perfect and overlapping speech is hard.

### Wispr Flow

Wispr Flow appears to be a user-facing dictation product, not the right backend transcription API for Tarry. It may be useful for personal dictation workflows, but it should not be in the core architecture unless we find a real developer API and speaker diarization support.

## Speaker Identity Strategy

Diarization alone gives generic labels like `Speaker 0` or `Speaker A`. To make those stable product identities, use this order:

1. Calibration: at session start, each person says their name for 2-10 seconds.
2. Known speaker references: pass those clips to the diarization provider when supported.
3. Face tracking: assign stable visual tracks such as `person_left`, `person_right`, `current_speaker`.
4. Fusion: align diarized speech timestamps with face/motion/attention signals.
5. Manual correction: allow the dashboard operator to rename `Speaker 0` to a real name.

For the hackathon, calibration plus manual correction is enough. Audio-visual active speaker detection is a later technical win.

## Event Shape

Suggested event:

```json
{
  "id": "evt_123",
  "type": "transcript",
  "source": "browser_microphone",
  "text": "I like $99 a month, but enterprise buyers will ask about trust.",
  "timestamp": "2026-05-16T19:30:00-07:00",
  "session_id": "office-session-001",
  "confidence": 0.91,
  "metadata": {
    "speaker_label": "speaker_1",
    "speaker_name": "Person 2",
    "start_ms": 13000,
    "end_ms": 20000,
    "provider": "openai",
    "model": "gpt-4o-transcribe-diarize"
  }
}
```

## Build Decision

We are good to start building with this plan:

1. Keep dashboard transcript generic but speaker-separated.
2. Add a provider interface: `TranscriptionProvider`.
3. Implement a replay provider first.
4. Implement OpenAI diarized chunk transcription next.
5. Keep Deepgram as the backup if we need live speaker labels.
6. Keep pyannote/WhisperX as the future local/private option.

Current implementation status:

- `TranscriptionProvider` and the replay provider exist.
- OpenAI `gpt-4o-transcribe-diarize` is not wired yet.
- Browser microphone capture is not wired yet.
- The next implementation step is to record browser mic chunks and submit completed chunks to the OpenAI diarized transcription provider.
