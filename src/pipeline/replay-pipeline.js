import { readFile } from "node:fs/promises";
import { normalizeReplayEvents } from "./events.js";
import { ReplayTranscriptProvider } from "../transcription/transcription-provider.js";

export async function loadReplaySession(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function buildReplayPipeline(path, options = {}) {
  const session = await loadReplaySession(path);
  const events = normalizeReplayEvents(session, options);
  const transcriptProvider = options.transcriptProvider ?? new ReplayTranscriptProvider();
  const transcriptTurns = await transcriptProvider.transcribeSession(session);
  return {
    session,
    events,
    transcriptTurns,
  };
}

