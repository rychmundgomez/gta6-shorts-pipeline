// fetch-news.ts
// Replaces manual weekly-content.ts — automatically scouts Rockstar's
// official Newswire RSS feed for GTA6-relevant news from the past week.
//
// Deliberately sourced from Rockstar's own official feed rather than
// scraping arbitrary third-party sites — it's the one source we can be
// confident is both accurate and not itself infringing anything.

import Parser from "rss-parser";
import type { NewsItem, NewsTag } from "./content-schema";

const NEWSWIRE_RSS_URL = "https://www.rockstargames.com/newswire.rss";
const LOOKBACK_DAYS = 8; // slightly wider than the weekly cadence, covers any gap between runs

// Keywords used to filter Rockstar's general Newswire (which covers all
// their games) down to just GTA6-relevant items.
const GTA6_KEYWORDS = [
  "grand theft auto vi",
  "grand theft auto 6",
  "gta 6",
  "gta vi",
  "leonida",
  "jason and lucia",
];

function isGTA6Relevant(title: string, content: string): boolean {
  const haystack = `${title} ${content}`.toLowerCase();
  return GTA6_KEYWORDS.some((kw) => haystack.includes(kw));
}

function inferTags(title: string, content: string): NewsTag[] {
  const text = `${title} ${content}`.toLowerCase();
  const tags: NewsTag[] = [];
  if (text.includes("pre-order") || text.includes("preorder")) tags.push("pre-order");
  if (text.includes("trailer")) tags.push("trailer");
  if (text.includes("price") || text.includes("$")) tags.push("pricing");
  if (text.includes("release date") || text.includes("launch")) tags.push("release-date");
  if (text.includes("platform") || text.includes("ps5") || text.includes("xbox")) tags.push("platform");
  if (text.includes("online")) tags.push("online-mode");
  return tags.length > 0 ? tags : ["other"];
}

export async function fetchLatestGTA6News(): Promise<NewsItem[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(NEWSWIRE_RSS_URL);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const items: NewsItem[] = [];

  for (const entry of feed.items ?? []) {
    if (!entry.title || !entry.link || !entry.pubDate) continue;

    const pubDate = new Date(entry.pubDate);
    if (pubDate < cutoff) continue;

    const rawContent = entry.contentSnippet ?? entry.content ?? "";
    if (!isGTA6Relevant(entry.title, rawContent)) continue;

    items.push({
      id: `newswire-${pubDate.toISOString().slice(0, 10)}-${entry.title.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: entry.title,
      date: pubDate.toISOString().slice(0, 10),
      // Capped length — this is Rockstar's own official RSS description,
      // used here as internal input material. The script-generation step
      // (generate-script.ts) rewrites this into fully original wording
      // before anything reaches a published video or description.
      summary: rawContent.slice(0, 500),
      sourceName: "Rockstar Newswire",
      sourceUrl: entry.link,
      tags: inferTags(entry.title, rawContent),
    });
  }

  return items;
}
