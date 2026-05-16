export const DEFAULT_SESSION_DATE = "2026-05-16";

export function normalizeReplayEvents(session, options = {}) {
  const sessionDate = options.sessionDate ?? DEFAULT_SESSION_DATE;
  return session.events.map((event, index) => normalizeReplayEvent(session, event, index, sessionDate));
}

function normalizeReplayEvent(session, event, index, sessionDate) {
  const atMs = event.atMs ?? event.at_ms ?? 0;
  return {
    id: `evt_${String(index + 1).padStart(3, "0")}`,
    type: event.type,
    source: sourceForEvent(event),
    text: textForEvent(event),
    session_id: session.sessionId,
    at_ms: atMs,
    timestamp: timestampForOffset(sessionDate, atMs),
    ...event,
  };
}

function sourceForEvent(event) {
  if (event.type === "gaze" || event.type === "reaction") return "robot";
  if (event.type === "memory_write") return event.payload?.source ?? "physical_room";
  return "replay";
}

function textForEvent(event) {
  if (typeof event.text === "string") return event.text;
  if (event.type === "gaze") return `Reachy gaze target: ${event.target}.`;
  if (event.type === "memory_write") return event.payload?.text ?? "Memory write.";
  return event.type;
}

function timestampForOffset(sessionDate, atMs) {
  const seconds = String(Math.floor(atMs / 1000)).padStart(2, "0");
  return `${sessionDate}T12:00:${seconds}.000-07:00`;
}

export function summarizeEvents(events) {
  return {
    transcript: events.filter((event) => event.type === "transcript"),
    context: events.filter((event) => event.type === "context"),
    memoryWrites: events.filter((event) => event.type === "memory_write"),
    gaze: events.filter((event) => event.type === "gaze"),
    reactions: events.filter((event) => event.type === "reaction"),
  };
}
