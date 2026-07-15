// generate-voiceover.ts
// Step 2 of the pipeline: approved DraftScript -> ElevenLabs TTS -> audio file + timed captions.
// Only runs after a script has been approved (see generate-script.ts).

import type { DraftScript } from "./generate-script";
import fs from "fs/promises";

// ---------------------------------------------------------------------------
// Config — move real values to environment variables, never hardcode keys
// ---------------------------------------------------------------------------
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID!; // pick one voice and stick with it — consistency matters for channel identity

// Remotion serves dynamically generated assets from a `public/` folder next
// to the entry point (index.ts), accessed via staticFile() at render time.
// Writing here — not to an arbitrary output folder — is what makes the
// <Audio> component able to find the file during rendering.
const PUBLIC_AUDIO_DIR = "./public/audio";

// ---------------------------------------------------------------------------
// Output shape passed to the video template step
// ---------------------------------------------------------------------------
export interface VoiceoverResult {
  weekOf: string;
  audioPath: string;         // relative to public/, e.g. "audio/2026-07-10-voiceover.mp3" — use with staticFile()
  captions: CaptionLine[];   // per-segment timing for burned-in captions
  totalDurationSeconds: number;
}

export interface CaptionLine {
  text: string;              // one script segment (hook / bullet / close)
  startSeconds: number;
  endSeconds: number;
  status?: "confirmed" | "not-confirmed" | "rumored"; // carried over for on-screen tagging
}

// ---------------------------------------------------------------------------
// Build the full narration text as segments, so we can request per-segment
// timing rather than one giant blob with no caption sync.
// ---------------------------------------------------------------------------
interface Segment {
  text: string;
  status?: CaptionLine["status"];
}

function buildSegments(script: DraftScript): Segment[] {
  return [
    { text: script.hook },
    ...script.bullets.map((b) => ({ text: b.text, status: b.status })),
    { text: script.close },
  ];
}

// ---------------------------------------------------------------------------
// ElevenLabs call — using their timestamps endpoint so we get per-character
// alignment back, which we then collapse into per-segment caption timing.
// ---------------------------------------------------------------------------
async function synthesizeWithTimestamps(fullText: string): Promise<{
  audioBase64: string;
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: fullText,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return {
    audioBase64: data.audio_base64,
    characters: data.alignment.characters,
    characterStartTimesSeconds: data.alignment.character_start_times_seconds,
    characterEndTimesSeconds: data.alignment.character_end_times_seconds,
  };
}

// ---------------------------------------------------------------------------
// Collapse character-level timestamps into segment-level caption lines by
// walking the concatenated text and matching each segment's character span.
// ---------------------------------------------------------------------------
function alignSegmentsToTimestamps(
  segments: Segment[],
  fullText: string,
  characters: string[],
  startTimes: number[],
  endTimes: number[]
): CaptionLine[] {
  const lines: CaptionLine[] = [];
  let cursor = 0;

  for (const seg of segments) {
    const segStart = fullText.indexOf(seg.text, cursor);
    if (segStart === -1) {
      throw new Error(`Could not align segment to synthesized text: "${seg.text}"`);
    }
    const segEnd = segStart + seg.text.length;

    lines.push({
      text: seg.text,
      status: seg.status,
      startSeconds: startTimes[segStart] ?? 0,
      endSeconds: endTimes[segEnd - 1] ?? startTimes[segStart] + 2,
    });

    cursor = segEnd;
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function generateVoiceover(script: DraftScript): Promise<VoiceoverResult> {
  const segments = buildSegments(script);
  // Join with a pause-friendly separator; ElevenLabs respects punctuation for pacing
  const fullText = segments.map((s) => s.text).join(" ... ");

  const { audioBase64, characters, characterStartTimesSeconds, characterEndTimesSeconds } =
    await synthesizeWithTimestamps(fullText);

  await fs.mkdir(PUBLIC_AUDIO_DIR, { recursive: true });
  const relativeAudioPath = `audio/${script.weekOf}-voiceover.mp3`; // relative to public/, for use with staticFile()
  await fs.writeFile(`${PUBLIC_AUDIO_DIR}/${script.weekOf}-voiceover.mp3`, Buffer.from(audioBase64, "base64"));

  const captions = alignSegmentsToTimestamps(
    segments,
    fullText,
    characters,
    characterStartTimesSeconds,
    characterEndTimesSeconds
  );

  const totalDurationSeconds = captions[captions.length - 1]?.endSeconds ?? 0;

  return {
    weekOf: script.weekOf,
    audioPath: relativeAudioPath,
    captions,
    totalDurationSeconds,
  };
}
