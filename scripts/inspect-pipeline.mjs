#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReplayPipeline } from "../src/pipeline/replay-pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const demoPath = join(repoRoot, "apps/dashboard/data/demo-session.json");

const pipeline = await buildReplayPipeline(demoPath);

console.log(JSON.stringify({
  session_id: pipeline.session.sessionId,
  title: pipeline.session.title,
  event_count: pipeline.events.length,
  transcript_turns: pipeline.transcriptTurns,
  event_types: countBy(pipeline.events, "type"),
}, null, 2));

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}

