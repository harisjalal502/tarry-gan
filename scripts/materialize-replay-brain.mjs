#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBrainFiles } from "../src/memory/gbrain-pages.js";
import { buildReplayPipeline } from "../src/pipeline/replay-pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const checkOnly = process.argv.includes("--check");

const demoPath = join(repoRoot, "apps/dashboard/data/demo-session.json");
const brainRoot = join(repoRoot, "brain");

async function writeIfChanged(path, content) {
  let existing = null;
  try {
    existing = await readFile(path, "utf8");
  } catch {
    // File does not exist yet.
  }
  if (existing === content) return false;
  if (checkOnly) {
    throw new Error(`${path} is not materialized or is stale. Run npm run brain:materialize.`);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return true;
}

async function main() {
  const pipeline = await buildReplayPipeline(demoPath);
  const writes = buildBrainFiles(pipeline.session, pipeline.events)
    .map(([relativePath, content]) => [join(brainRoot, relativePath), content]);

  const changed = [];
  for (const [path, content] of writes) {
    if (await writeIfChanged(path, content)) changed.push(path);
  }

  if (checkOnly) {
    console.log("brain materialization is current");
    return;
  }

  console.log(`materialized ${writes.length} brain files (${changed.length} changed)`);
  for (const path of changed) {
    console.log(path.replace(`${repoRoot}/`, ""));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

