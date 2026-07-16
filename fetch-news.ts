// fetch-news.ts
// Replaces manual weekly-content.ts — automatically scouts news for GTA6
// via Google News' RSS search endpoint (a real, stable, no-API-key-required
// feature — the same approach used by existing GTA6 tracker sites like
// leonida.vc, which labels its aggregated items "Google News").
//
// This intentionally aggregates across outlets rather than relying on a
// single site's own RSS feed, which also means it naturally picks up both
// official Rockstar announcements (as covered by outlets) and third-party
// reporting on rumors/speculation — useful for the "rumored" side of the
// fact-check format, which a Rockstar-only source can't provide.

import Parser from "rss-parser";
import type { NewsItem, NewsTag } from "./content-schema";

const SEARCH_QUERY = '"GTA 6" OR "Grand Theft Auto VI"';
const GOOGLE_NEWS_RSS_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(SEARCH_QUERY)}&hl=en-US&gl=US&ceid=US:en`;
const LOOKBACK_DAYS = 8; // slightly wider than the weekly cadence, covers any gap between runs
const MAX_ITEMS = 8; // cap how many stories feed into a single script

function extractSourceName(title: string): { cleanTitle: string; sourceName: string } {
  // Google News titles are typically formatted "Article Title - Source Name"
  const lastDash = title.lastIndexOf(" - ");
  if (lastDash === -1) return { cleanTitle: title, sourceName: "Google News" };
  return {
    cleanTitle: title.slice(0, lastDash),
    sourceName: title.slice(lastDash + 3),
  };
}

function inferTags(title: string, content: string): NewsTag[] {
  const text = `${title} ${content}`.toLowerCase();
  const tags: NewsTag[] = [];
  if (text.includes("pre-order") || text.includes("preorder")) tags.push("pre-order");
  if (text.includes("trailer")) tags.push("trailer");
  if (text.includes("price") || text.includes("$")) tags.push("pricing");
  if (text.includes("release date") || text.includes("launch") || text.includes("delay")) tags.push("release-date");
  if (text.includes("platform") || text.includes("ps5") || text.includes("xbox") || text.includes("pc")) tags.push("platform");
  if (text.includes("online")) tags.push("online-mode");
  return tags.length > 0 ? tags : ["other"];
}

export async function fetchLatestGTA6News(): Promise<NewsItem[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(GOOGLE_NEWS_RSS_URL);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const items: NewsItem[] = [];

  for (const entry of feed.items ?? []) {
    if (!entry.title || !entry.link || !entry.pubDate) continue;

    const pubDate = new Date(entry.pubDate);
    if (pubDate < cutoff) continue;

    const { cleanTitle, sourceName } = extractSourceName(entry.title);
    const rawContent = entry.contentSnippet ?? entry.content ?? "";

    items.push({
      id: `gnews-${pubDate.toISOString().slice(0, 10)}-${cleanTitle.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: cleanTitle,
      date: pubDate.toISOString().slice(0, 10),
      // Capped length — this is aggregated third-party material, used here
      // as internal input. generate-script.ts rewrites this into fully
      // original wording before anything reaches a published video.
      summary: rawContent.slice(0, 400),
      sourceName,
      sourceUrl: entry.link,
      tags: inferTags(cleanTitle, rawContent),
    });

    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}

