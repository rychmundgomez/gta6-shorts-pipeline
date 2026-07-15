// fetch-background.ts
// Step between voiceover and render: picks a themed stock video clip from
// Pexels (free commercial license, no attribution required) and downloads
// it locally so the Remotion template can use it as a background layer.

import fs from "fs/promises";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY!;
const PUBLIC_VIDEO_DIR = "./public/background";

// Rotate through a small set of mood-appropriate, generic themes — none of
// these reference GTA/Rockstar specifically, just the general aesthetic
// (night city, palm trees, neon streets) that fits the show's vibe without
// depending on any particular IP.
const THEMES = [
  "night city driving",
  "miami skyline sunset",
  "palm trees neon street",
  "city lights aerial",
  "highway night traffic",
];

function pickTheme(weekOf: string): string {
  // Deterministic per-week pick so re-renders of the same week are consistent
  const hash = weekOf.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return THEMES[hash % THEMES.length];
}

export interface BackgroundResult {
  videoPath: string; // relative to public/, for use with staticFile()
  durationSeconds: number; // real clip length from Pexels — needed for correct looping
  theme: string;
  sourceUrl: string; // Pexels page URL, kept for your own reference/records
}

export async function fetchBackgroundVideo(weekOf: string): Promise<BackgroundResult> {
  const theme = pickTheme(weekOf);

  const searchResponse = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(theme)}&orientation=portrait&size=medium&per_page=5`,
    { headers: { Authorization: PEXELS_API_KEY } }
  );

  if (!searchResponse.ok) {
    throw new Error(`Pexels search failed: ${searchResponse.status} ${await searchResponse.text()}`);
  }

  const searchData = await searchResponse.json();
  const videos = searchData.videos as any[];

  if (!videos || videos.length === 0) {
    throw new Error(`No Pexels results for theme "${theme}" — try a different query or fall back to the animated background.`);
  }

  // Pick the first result, prefer a file already close to 1080x1920 if available
  const video = videos[0];
  const files = video.video_files as any[];
  const bestFile =
    files.find((f) => f.width && f.height && f.height > f.width && f.height >= 1280) ??
    files.find((f) => f.width && f.height && f.height > f.width) ??
    files[0];

  const fileResponse = await fetch(bestFile.link);
  if (!fileResponse.ok) {
    throw new Error(`Failed to download Pexels video file: ${fileResponse.status}`);
  }
  const buffer = Buffer.from(await fileResponse.arrayBuffer());

  await fs.mkdir(PUBLIC_VIDEO_DIR, { recursive: true });
  const filename = `${weekOf}-background.mp4`;
  await fs.writeFile(`${PUBLIC_VIDEO_DIR}/${filename}`, buffer);

  return {
    videoPath: `background/${filename}`, // relative to public/, matches staticFile() convention
    durationSeconds: video.duration ?? 15, // Pexels reports this directly; 15s fallback only if missing
    theme,
    sourceUrl: video.url,
  };
}
