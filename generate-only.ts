// generate-only.ts
// GitHub Actions Job 1: generates the script, writes it somewhere reviewable,
// and saves it as a file for Job 2 to pick up after your approval.
//
// Usage: npx tsx generate-only.ts

import "dotenv/config";
import fs from "fs/promises";
import { generateScript, type ScriptRequest } from "./generate-script";
import { fetchLatestGTA6News } from "./fetch-news";

async function main() {
  const newsItems = await fetchLatestGTA6News();

  const weekOf = new Date().toISOString().slice(0, 10);
  const request: ScriptRequest = {
    weekOf,
    newsItems,
    factUpdates: [], // fact-tracker entries still require manual judgment for now — see note below
  };

  if (newsItems.length === 0) {
    console.log("No new GTA6-relevant Newswire items found this week — skipping script generation.");
    return;
  }

  const script = await generateScript(request);

  // Save for Job 2 to read after approval
  await fs.mkdir("./pipeline-output", { recursive: true });
  await fs.writeFile("./pipeline-output/approved-script.json", JSON.stringify(script));

  // Write to the GitHub Actions job summary — this is what you'll actually
  // read when you open the pending-approval email link, since GitHub shows
  // the summary right on the run page.
  const summary = [
    `## Script pending approval — week of ${script.weekOf}`,
    ``,
    `**Hook:** ${script.hook}`,
    ``,
    ...script.bullets.map((b) => `- **[${b.status.toUpperCase()}]** ${b.text}${b.sourceUrl ? ` ([source](${b.sourceUrl}))` : ""}`),
    ``,
    `**Close:** ${script.close}`,
    ``,
    `_Estimated length: ~${script.estimatedSeconds}s_`,
  ].join("\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  console.log(summary);
}

main().catch((err) => {
  console.error("Script generation failed:", err);
  process.exit(1);
});
