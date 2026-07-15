// get-refresh-token.ts
// Run this ONCE to authorize your own YouTube channel and obtain a refresh token.
// After this, delete or ignore this file — the pipeline never needs to run it again.
//
// Usage: npx tsx get-refresh-token.ts
// (requires YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI set in .env)

import "dotenv/config"; // loads .env into process.env — without this, all process.env values below are undefined
import { google } from "googleapis";
import http from "http";
import { URL } from "url";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || "http://localhost:8080/oauth2callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",   // required to get a refresh_token back, not just an access_token
  prompt: "consent",        // forces the consent screen so a refresh_token is issued even on repeat runs
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
});

console.log("\n1. Open this URL in your browser and log in with the Google account that owns your YouTube channel:\n");
console.log(authUrl);
console.log("\n2. After you approve, you'll be redirected to localhost — this script is listening and will catch it automatically.\n");

const server = http
  .createServer(async (req, res) => {
    if (!req.url) return;
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get("code");

    if (code) {
      res.end("Success — you can close this tab and return to your terminal.");
      server.close();

      const { tokens } = await oauth2Client.getToken(code);
      console.log("\n=== SAVE THIS AS YOUTUBE_REFRESH_TOKEN ===\n");
      console.log(tokens.refresh_token);
      console.log("\n===========================================\n");
      console.log("Add it to your .env file, then this script is no longer needed.");
    }
  })
  .listen(8080, () => {
    console.log("Waiting for you to approve access in the browser...\n");
  });
