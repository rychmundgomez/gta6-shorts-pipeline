# Setup Guide — GTA 6 Shorts Pipeline

Follow this in order. Steps 1-2 are quick. Step 3 (YouTube) is the fiddly one — budget 15-20 minutes for it the first time.

## 1. Project setup

```bash
mkdir gta6-shorts-pipeline && cd gta6-shorts-pipeline
# copy in all the .ts/.tsx files, package.json, and .env.example from this conversation
npm install
cp .env.example .env
```

You'll fill in `.env` as you go through the steps below.

## 2. Anthropic API key (script generation)

1. Go to [console.anthropic.com](https://console.anthropic.com) and log in.
2. Navigate to **API Keys** → **Create Key**.
3. Copy the key into `.env` as `ANTHROPIC_API_KEY`.

That's it — `generate-script.ts` uses this directly.

## 3. ElevenLabs (voiceover)

1. Sign up at [elevenlabs.io](https://elevenlabs.io). The free tier works for testing; check current pricing for your expected volume (a few Shorts a week is usually within a low paid tier).
2. Go to **Profile → API Keys**, copy it into `.env` as `ELEVENLABS_API_KEY`.
3. Go to the **Voice Library**, pick one voice (browse a few — this becomes your channel's "voice," worth spending 10 minutes on), click it, and copy its **Voice ID** into `.env` as `ELEVENLABS_VOICE_ID`.

## 4. YouTube Data API (upload) — the longer one

### 4a. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (top left dropdown → New Project). Name it anything, e.g. "gta6-shorts-pipeline".
3. With that project selected, go to **APIs & Services → Library**, search "YouTube Data API v3", and click **Enable**.

### 4b. Create OAuth2 credentials

1. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External** (unless you have a Google Workspace account).
   - Fill in the required app name/email fields — this doesn't need to be polished, it's just for your own use.
   - Under **Scopes**, you don't need to add anything manually here — the script requests the scope directly.
   - Under **Test users**, add the Google account email that owns your YouTube channel. While the app is in "Testing" mode, only test users can authorize it — that's fine, you don't need to publish the app publicly.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add `http://localhost:8080/oauth2callback`.
3. Copy the generated **Client ID** and **Client Secret** into `.env` as `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.

### 4c. Get your refresh token (one-time)

```bash
npm run get-youtube-token
```

This opens a URL for you to visit — log in with the YouTube-owning account, approve access, and the script catches the redirect automatically and prints a refresh token in your terminal. Copy it into `.env` as `YOUTUBE_REFRESH_TOKEN`.

You only do this once. After this, `upload-to-youtube.ts` refreshes access tokens automatically forever using this stored value — unless you revoke access from your Google account settings.

## 5. Remotion (video rendering)

No account needed — it's a library, already in `package.json`. But it does need a Chromium binary, which it installs automatically on first render:

```bash
npx remotion render FactCheckShort --help
```

If this is your first time running it on this machine, it may download Chromium (a few hundred MB) — let it finish.

**Where you run this matters:** renders need real CPU/memory for a sustained period (not a quick serverless call). Your own machine works for testing. For hands-off weekly automation, a small always-on VM (DigitalOcean, a cheap EC2 instance) or a scheduled GitHub Actions runner both work — just not a typical serverless function due to timeout/memory limits.

## 6. Test the full chain once, manually

Before scheduling anything automatically, run it once by hand so you can watch each step:

```bash
npm run run-pipeline
```

- It'll generate a script and print it to your console (`sendForApproval`'s stub does this via `console.log` right now).
- It'll then wait — write `approved` into `./pipeline-output/approval.txt` to let it continue.
- Voiceover, render, and upload happen automatically from there. Check `pipeline-output/` for the audio and video files, and check your YouTube Studio for the scheduled upload.

## 7. Automate the weekly trigger

Once step 6 works end-to-end, wire `run-pipeline.ts` to run on a schedule — a cron job, or a scheduled GitHub Actions workflow, calling `npm run run-pipeline` weekly. Keep the approval step pointed at something you'll actually see (swap the file-polling stub in `run-pipeline.ts` for a real Telegram or Slack message) so the pipeline doesn't sit idle waiting on a file you forgot to check.

## A note on costs

Roughly, for a few Shorts a week: Anthropic API calls are pennies per script, ElevenLabs is a low monthly tier for this volume, YouTube API is free (just quota-limited), and Remotion is free (just your own compute time). The main real cost is whatever you host the render/cron job on, if not your own machine.
