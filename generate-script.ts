// generate-script.ts
// Step 1 of the pipeline: structured content -> Claude API -> draft script -> approval queue.
// Nothing downstream (voiceover, render, upload) runs until a script is approved.

import type { NewsItem, FactEntry } from "./content-schema";

// ---------------------------------------------------------------------------
// Input: the week's new/updated facts, pulled from your content-schema files
// ---------------------------------------------------------------------------
export interface ScriptRequest {
  weekOf: string;                 // ISO date, for logging/filenames
  newsItems: NewsItem[];          // this week's news, most recent first
  factUpdates: FactEntry[];       // any FactEntry rows changed this week
}

export interface DraftScript {
  weekOf: string;
  hook: string;
  bullets: ScriptBullet[];
  close: string;
  estimatedSeconds: number;
  rawModelOutput: string;         // kept for audit/debugging
}

export interface ScriptBullet {
  status: "confirmed" | "not-confirmed" | "rumored";
  text: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// The prompt — this is the part worth iterating on most
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `
You write scripts for a 60-90 second YouTube Shorts series called "GTA 6 — Confirmed vs Rumored."

Format rules (always follow exactly):
- Hook: one sentence, under 15 words, states why this update matters right now.
- 3-6 bullets, each one fact, each tagged CONFIRMED, NOT CONFIRMED, or RUMORED.
- Each bullet is a single sentence, plain spoken language, no jargon.
- Every CONFIRMED or NOT CONFIRMED bullet must be traceable to a specific source
  from the provided input — never invent or infer a fact that isn't in the input.
- If the input doesn't contain enough new material for a full script, say so
  explicitly instead of padding with restated old facts.
- Close: one sentence inviting a follow, under 15 words.
- Do not use quotation marks from source articles verbatim — always paraphrase.

Output ONLY valid JSON matching this shape, nothing else, no markdown fences:
{
  "hook": string,
  "bullets": [{ "status": "confirmed" | "not-confirmed" | "rumored", "text": string, "sourceUrl": string | null }],
  "close": string,
  "insufficientMaterial": boolean
}
`.trim();

function buildUserPrompt(req: ScriptRequest): string {
  const newsBlock = req.newsItems
    .map((n) => `- [${n.date}] ${n.title}: ${n.summary} (source: ${n.sourceUrl})`)
    .join("\n");

  const factBlock = req.factUpdates
    .map((f) => `- ${f.topic} [${f.status.toUpperCase()}]: ${f.detail} (source: ${f.sourceUrl ?? "none"})`)
    .join("\n");

  return `
Week of: ${req.weekOf}

NEW/UPDATED NEWS ITEMS:
${newsBlock || "(none this week)"}

CHANGED FACT-TRACKER ENTRIES:
${factBlock || "(none this week)"}

Write this week's script from only the material above.
`.trim();
}

// ---------------------------------------------------------------------------
// Call Claude's API
// ---------------------------------------------------------------------------
export async function generateScript(req: ScriptRequest): Promise<DraftScript> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(req) }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Surface the actual API error instead of failing later with a confusing "undefined" error
    throw new Error(
      `Anthropic API request failed (status ${response.status}): ${JSON.stringify(data)}`
    );
  }

  if (!data.content || !Array.isArray(data.content)) {
    throw new Error(`Unexpected Anthropic API response shape: ${JSON.stringify(data)}`);
  }

  const rawText: string = data.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  let parsed: any;
  try {
    // Extract just the JSON object itself, in case the model added markdown
    // fences or trailing commentary despite being told not to — more robust
    // than only stripping ``` fences.
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error("No JSON object found in model output");
    }
    const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
    parsed = JSON.parse(jsonSlice);
  } catch (err) {
    throw new Error(`Model did not return valid JSON: ${rawText}`);
  }

  if (parsed.insufficientMaterial) {
    throw new Error("Not enough new material this week — skip this cycle rather than pad the script.");
  }

  const bullets: ScriptBullet[] = parsed.bullets.map((b: any) => ({
    status: b.status,
    text: b.text,
    sourceUrl: b.sourceUrl ?? undefined,
  }));

  // Rough pacing estimate: ~2.5 words/sec spoken, plus fixed hook/close overhead
  const wordCount =
    parsed.hook.split(" ").length +
    bullets.reduce((sum, b) => sum + b.text.split(" ").length, 0) +
    parsed.close.split(" ").length;
  const estimatedSeconds = Math.round(wordCount / 2.5);

  return {
    weekOf: req.weekOf,
    hook: parsed.hook,
    bullets,
    close: parsed.close,
    estimatedSeconds,
    rawModelOutput: rawText,
  };
}

// ---------------------------------------------------------------------------
// Approval step — this is the one manual checkpoint in the whole pipeline.
// Sends the draft somewhere you'll actually see it (swap in Slack/Telegram/email).
// Downstream steps (voiceover, render, upload) should only run after this
// resolves to "approved".
// ---------------------------------------------------------------------------
export async function sendForApproval(script: DraftScript): Promise<void> {
  const readable = [
    `Script for week of ${script.weekOf} (~${script.estimatedSeconds}s):`,
    ``,
    `HOOK: ${script.hook}`,
    ``,
    ...script.bullets.map(
      (b) => `[${b.status.toUpperCase()}] ${b.text}${b.sourceUrl ? ` (${b.sourceUrl})` : ""}`
    ),
    ``,
    `CLOSE: ${script.close}`,
  ].join("\n");

  // TODO: replace with an actual notification call, e.g.:
  //   await sendTelegramMessage(readable);
  //   await sendSlackMessage(readable);
  console.log("=== SCRIPT PENDING APPROVAL ===\n" + readable);
}
