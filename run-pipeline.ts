// run-pipeline.ts
// Ties the four steps together end-to-end, with the one manual approval gate
// sitting between script generation and everything else.
//
// Trigger this weekly (cron, GitHub Actions schedule, etc.) — it stops and
// waits at the approval step rather than running unattended straight through.

import "dotenv/config"; // loads .env into process.env for every step below
import { generateScript, sendForApproval, type ScriptRequest, type DraftScript } from "./generate-script";
import { generateVoiceover } from "./generate-voiceover";
import { fetchBackgroundVideo } from "./fetch-background";
import { uploadShort } from "./upload-to-youtube";
import { execSync } from "child_process";
import fs from "fs/promises";

// ---------------------------------------------------------------------------
// Swap this for your real approval channel (Telegram bot, Slack app, etc.)
// This stub just polls a local file you edit by hand: write "approved" or
// "rejected" into ./pipeline-output/approval.txt after reviewing the script.
// ---------------------------------------------------------------------------
async function waitForApproval(): Promise<"approved" | "rejected"> {
  const APPROVAL_FILE = "./pipeline-output/approval.txt";
  const POLL_INTERVAL_MS = 30_000;
  const TIMEOUT_MS = 1000 * 60 * 60 * 24; // give yourself a full day to review

  await fs.mkdir("./pipeline-output", { recursive: true }); // ensure the folder exists before we start polling it

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const content = (await fs.readFile(APPROVAL_FILE, "utf-8")).trim();
      if (content === "approved" || content === "rejected") {
        await fs.rm(APPROVAL_FILE); // reset for next run
        return content;
      }
    } catch {
      // file doesn't exist yet — keep waiting
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Approval timed out — no response within 24 hours.");
}

// ---------------------------------------------------------------------------
// Full pipeline run
// ---------------------------------------------------------------------------
export async function runWeeklyPipeline(request: ScriptRequest) {
  console.log(`[1/4] Generating script for week of ${request.weekOf}...`);
  const script: DraftScript = await generateScript(request);

  console.log(`[2/4] Sending script for approval — pipeline pauses here.`);
  await sendForApproval(script);

  const decision = await waitForApproval();
  if (decision === "rejected") {
    console.log("Script rejected — stopping this cycle. Nothing was rendered or posted.");
    return;
  }

  console.log(`[3/4] Approved. Generating voiceover...`);
  const voiceover = await generateVoiceover(script);

  console.log(`Fetching stock background footage...`);
  let backgroundVideoPath: string | undefined;
  let backgroundVideoDurationSeconds: number | undefined;
  try {
    const background = await fetchBackgroundVideo(script.weekOf);
    console.log(`Using theme "${background.theme}" (source: ${background.sourceUrl})`);
    backgroundVideoPath = background.videoPath;
    backgroundVideoDurationSeconds = background.durationSeconds;
  } catch (err) {
    console.warn(`Background fetch failed, falling back to animated gradient: ${err}`);
  }

  console.log(`[4/4] Rendering video via Remotion...`);
  const outputPath = `./pipeline-output/${script.weekOf}-short.mp4`;
  const propsPath = `./pipeline-output/${script.weekOf}-props.json`;
  await fs.writeFile(
    propsPath,
    JSON.stringify({ script, voiceover, backgroundVideoPath, backgroundVideoDurationSeconds })
  );

  execSync(
    `npx remotion render index.ts FactCheckShort ${outputPath} --props=${propsPath}`,
    { stdio: "inherit" }
  );

  console.log(`Uploading to YouTube (scheduled)...`);
  const publishAt = nextWednesday9am();
  const { url } = await uploadShort({ videoPath: outputPath, script, publishAt });

  console.log(`Done. Scheduled for ${publishAt.toISOString()}: ${url}`);
}

// ---------------------------------------------------------------------------
// Simple scheduling helper — adjust cadence to match your content calendar
// ---------------------------------------------------------------------------
function nextWednesday9am(): Date {
  const now = new Date();
  const result = new Date(now);
  const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7;
  result.setDate(now.getDate() + daysUntilWednesday);
  result.setHours(9, 0, 0, 0);
  return result;
}
