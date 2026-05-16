export class TranscriptionProvider {
  async transcribeSession() {
    throw new Error("TranscriptionProvider.transcribeSession must be implemented");
  }
}

export class ReplayTranscriptProvider extends TranscriptionProvider {
  async transcribeSession(session) {
    return session.events
      .filter((event) => event.type === "transcript")
      .map((event, index) => ({
        id: `turn_${String(index + 1).padStart(3, "0")}`,
        speaker_label: `speaker_${index + 1}`,
        speaker_name: event.speaker,
        start_ms: event.atMs,
        end_ms: event.atMs + estimateDurationMs(event.text),
        text: event.text,
        provider: "replay",
      }));
  }
}

function estimateDurationMs(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1600, Math.round((words / 145) * 60_000));
}

