// check-env.ts
// One-off debug script — confirms whether .env values are loading at all,
// without ever printing the actual secret values.
//
// Usage: npx tsx check-env.ts

import "dotenv/config";

const keysToCheck = [
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "PEXELS_API_KEY",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "YOUTUBE_REDIRECT_URI",
  "YOUTUBE_REFRESH_TOKEN",
];

console.log("Checking .env loading (showing presence + length only, never the actual value):\n");
for (const key of keysToCheck) {
  const value = process.env[key];
  if (value) {
    console.log(`${key}: SET (length ${value.length})`);
  } else {
    console.log(`${key}: MISSING`);
  }
}
