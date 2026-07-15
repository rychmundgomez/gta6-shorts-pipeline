// render-and-publish.ts
// GitHub Actions Job 2: runs ONLY after you approve via the Environment
// protection rule (the email link). Picks up the script Job 1 saved and
// completes the rest of the pipeline.
//
// Usage: npx tsx render-and-publish.ts

import "dotenv/config";
import fs from "fs/promises";
import { execSync } from "child_process";
import type { DraftScript } from "./generate-script";
import { generateVoiceover } from "./generate-voiceover";
import { fetchBackgroundVideo } from "./fetch-background";
import { uploadShort } from "./upload-to-youtube";

async function main() {
  const script: DraftScript = JSON.parse(
    await fs.readFile("./pipeline-output/approved-script.json", "utf-8")
  );

  console.log("Generating voiceover...");
  const voiceover = await generateVoiceover(script);

  console.log("Fetching stock background footage...");
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

  console.log("Rendering video via Remotion...");
  const outputPath = `./pipeline-output/${script.weekOf}-short.mp4`;
  const propsPath = `./pipeline-output/${script.weekOf}-props.json`;
  await fs.writeFile(
    propsPath,
    JSON.stringify({ script, voiceover, backgroundVideoPath, backgroundVideoDurationSeconds })
  );
  execSync(`npx remotion render index.ts FactCheckShort ${outputPath} --props=${propsPath}`, {
    stdio: "inherit",
  });

  console.log("Uploading to YouTube (scheduled)...");
  const publishAt = nextWednesday9am();
  const { url } = await uploadShort({ videoPath: outputPath, script, publishAt });

  console.log(`Done. Scheduled for ${publishAt.toISOString()}: ${url}`);
}

function nextWednesday9am(): Date {
  const now = new Date();
  const result = new Date(now);
  const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7;
  result.setDate(now.getDate() + daysUntilWednesday);
  result.setHours(9, 0, 0, 0);
  return result;
}

main().catch((err) => {
  console.error("Render/publish failed:", err);
  process.exit(1);
});
