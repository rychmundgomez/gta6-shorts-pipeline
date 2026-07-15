// content-schema.ts
// Shared content types for the Leonida Watch (GTA 6 tracker) site.
// Content itself lives as JSON files under /content/*, matching these shapes.
// No CMS, no backend — just typed data files committed to the repo.

// ---------------------------------------------------------------------------
// 1. NEWS ITEMS — short, dated summaries of official announcements
// ---------------------------------------------------------------------------
export interface NewsItem {
  id: string;                // slug, e.g. "2026-06-25-preorders-open"
  title: string;             // "Pre-orders open for GTA 6"
  date: string;               // ISO date, "2026-06-25"
  summary: string;           // 2-4 sentences, ORIGINAL wording, no copied text
  sourceName: string;        // "Rockstar Newswire", "Take-Two Earnings Call"
  sourceUrl: string;         // link back to the original — always required
  tags: NewsTag[];           // for filtering/search
  featured?: boolean;        // pin to homepage
}

export type NewsTag =
  | "release-date"
  | "pre-order"
  | "trailer"
  | "platform"
  | "pricing"
  | "online-mode"
  | "earnings"
  | "other";

// ---------------------------------------------------------------------------
// 2. EXPLAINER PAGES — evergreen, longer-form reference content
// ---------------------------------------------------------------------------
export interface ExplainerPage {
  id: string;                // slug, e.g. "who-are-jason-and-lucia"
  title: string;
  lastUpdated: string;       // ISO date — bump whenever facts change
  summary: string;           // 1-2 sentence teaser for link previews / SEO
  sections: ExplainerSection[];
  relatedFactIds?: string[]; // links into the Confirmed/Rumored tracker (see below)
}

export interface ExplainerSection {
  heading: string;
  body: string;              // markdown-formatted, original writing
}

// ---------------------------------------------------------------------------
// 3. CONFIRMED / RUMORED TRACKER — the fact-check table
// ---------------------------------------------------------------------------
export interface FactEntry {
  id: string;                 // e.g. "platforms"
  topic: string;              // "Platforms"
  status: "confirmed" | "rumored" | "denied";
  detail: string;             // "PS5 and Xbox Series X/S at launch. No PC version announced."
  sourceUrl?: string;         // required if status is "confirmed" or "denied"
  lastVerified: string;       // ISO date — re-check periodically, dates matter here
}

// ---------------------------------------------------------------------------
// 4. COMPARISON TABLES — structured reference data (editions, pricing, specs)
// ---------------------------------------------------------------------------
export interface ComparisonTable {
  id: string;                 // "editions"
  title: string;              // "GTA 6 Editions Compared"
  lastUpdated: string;
  columns: string[];          // ["Edition", "Price", "Platforms", "Bonus Content"]
  rows: string[][];           // one array per row, matching column order
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// 5. MILESTONE / COUNTDOWN POSTS — recurring scheduled content
// ---------------------------------------------------------------------------
export interface MilestonePost {
  id: string;                 // "3-months-out"
  title: string;
  publishDate: string;
  daysUntilLaunch: number;    // computed at publish time, stored for the record
  summary: string;
  linkedNewsIds?: string[];   // ties back to NewsItem entries from that period
}

// ---------------------------------------------------------------------------
// Example content file shape (content/news/2026-06-25-preorders-open.json)
// ---------------------------------------------------------------------------
/*
{
  "id": "2026-06-25-preorders-open",
  "title": "Pre-orders open for GTA 6",
  "date": "2026-06-25",
  "summary": "Rockstar opened pre-orders for the Standard and Ultimate editions on PS5 and Xbox Series X/S, priced at $79.99 and $99.99. Physical code-in-a-box copies reportedly sold out on Amazon within an hour of listing.",
  "sourceName": "Rockstar Newswire",
  "sourceUrl": "https://www.rockstargames.com/newswire/...",
  "tags": ["pre-order", "pricing"],
  "featured": true
}
*/
