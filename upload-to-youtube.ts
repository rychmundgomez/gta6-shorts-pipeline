// upload-to-youtube.ts
// Step 4 (final) of the pipeline: rendered .mp4 + DraftScript -> scheduled YouTube Shorts upload.
// Requires a one-time OAuth2 setup in Google Cloud Console (see notes at bottom).

import { google } from "googleapis";
import fs from "fs";
import type { DraftScript } from "./generate-script";

// ---------------------------------------------------------------------------
// OAuth2 client — refresh token is generated once during setup and reused
// indefinitely; the access token refreshes automatically on each call.
// ---------------------------------------------------------------------------
function buildAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI // e.g. "http://localhost:3000/oauth2callback", used only during initial setup
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

// ---------------------------------------------------------------------------
// Metadata builder — turns the script into a title/description matching
// the format your fact-check series has been using
// ---------------------------------------------------------------------------
export interface UploadRequest {
  videoPath: string;         // path to the rendered .mp4 from the Remotion step
  script: DraftScript;
  publishAt: Date;           // scheduled publish time, e.g. next Wed 9am
}

function buildTitle(script: DraftScript): string {
  // Keep it short — YouTube titles truncate on mobile around 60-70 chars
  return `GTA 6: Confirmed vs Rumored This Week #Shorts`;
}

function buildDescription(script: DraftScript): string {
  const factLines = script.bullets
    .map((b) => {
      const tag = b.status === "confirmed" ? "✅" : b.status === "not-confirmed" ? "❌" : "❓";
      return `${tag} ${b.text}${b.sourceUrl ? ` (source: ${b.sourceUrl})` : ""}`;
    })
    .join("\n");

  return [
    script.hook,
    "",
    factLines,
    "",
    "Follow for weekly GTA 6 fact-checks as we get closer to launch.",
    "",
    "#GTA6 #Shorts #GTA6News",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main upload call
// ---------------------------------------------------------------------------
export async function uploadShort(req: UploadRequest): Promise<{ videoId: string; url: string }> {
  const auth = buildAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: buildTitle(req.script),
        description: buildDescription(req.script),
        tags: ["GTA6", "GTA 6", "Grand Theft Auto 6", "Rockstar Games", "GTA6News"],
        categoryId: "20", // Gaming
      },
      status: {
        // "private" until publishAt, then YouTube flips it automatically
        privacyStatus: "private",
        publishAt: req.publishAt.toISOString(),
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(req.videoPath),
    },
  });

  const videoId = response.data.id!;
  return { videoId, url: `https://youtube.com/shorts/${videoId}` };
}

// ---------------------------------------------------------------------------
// ONE-TIME SETUP NOTES (not code that runs in the pipeline):
//
// 1. Create a project in Google Cloud Console, enable "YouTube Data API v3".
// 2. Create OAuth2 credentials (type: Desktop app or Web app).
// 3. Run a one-off local script using the same client ID/secret to complete
//    the OAuth consent flow once, authorizing your own YouTube channel.
//    That flow returns a refresh_token — save it as YOUTUBE_REFRESH_TOKEN.
// 4. From then on, this module refreshes access tokens automatically using
//    that stored refresh token — no repeated manual login.
// 5. Daily quota: a single video upload costs a meaningful chunk of the
//    default 10,000-unit daily quota. Check current costs in Google's
//    YouTube Data API quota docs before planning high daily volume —
//    quota costs and limits are the kind of detail that changes over time.
// ---------------------------------------------------------------------------
