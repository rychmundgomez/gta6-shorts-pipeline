// test-run.ts
// One-off test to confirm the full pipeline works mechanically.
// Uses made-up (but realistic-shaped) sample data — replace with real
// NewsItem/FactEntry entries from your content-schema once this succeeds.
//
// Usage: npx tsx test-run.ts

import "dotenv/config";
import { runWeeklyPipeline } from "./run-pipeline";
import type { ScriptRequest } from "./generate-script";

const testRequest: ScriptRequest = {
  weekOf: "2026-07-10-test",
  newsItems: [
    {
      id: "test-news-1",
      title: "Rockstar posts new developer diary video",
      date: "2026-07-08",
      summary:
        "Rockstar released a short developer diary discussing environmental design choices in Leonida, focusing on weather systems and lighting. No new gameplay footage was shown.",
      sourceName: "Rockstar Newswire (sample/fictional for pipeline testing)",
      sourceUrl: "https://example.com/test-source",
      tags: ["other"],
    },
  ],
  factUpdates: [
    {
      id: "test-fact-1",
      topic: "Developer diary release",
      status: "confirmed",
      detail:
        "A developer diary video was posted focusing on environmental design, not gameplay mechanics.",
      sourceUrl: "https://example.com/test-source",
      lastVerified: "2026-07-08",
    },
    {
      id: "test-fact-2",
      topic: "New gameplay footage",
      status: "rumored",
      detail:
        "Some fan speculation suggests more gameplay footage is coming soon, but nothing has been officially scheduled.",
      lastVerified: "2026-07-08",
    },
  ],
};

console.log("Running pipeline with TEST DATA — nothing here reflects real GTA 6 news.\n");
runWeeklyPipeline(testRequest).catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
