// FactCheckShort.tsx
// Step 3 of the pipeline: DraftScript + VoiceoverResult -> rendered vertical video.
// Built as a Remotion composition — run via `npx remotion render` to produce the final .mp4.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Loop,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import type { DraftScript } from "./generate-script";
import type { VoiceoverResult, CaptionLine } from "./generate-voiceover";

// ---------------------------------------------------------------------------
// Composition props — passed in via Remotion's `inputProps` at render time
// ---------------------------------------------------------------------------
export interface FactCheckShortProps {
  script: DraftScript;
  voiceover: VoiceoverResult;
  backgroundVideoPath?: string; // relative to public/, from fetch-background.ts — falls back to animated gradient if omitted
  backgroundVideoDurationSeconds?: number; // real clip length from Pexels, needed to loop correctly
}

// Vertical Shorts format: 1080x1920, 30fps is the safe default for Remotion renders
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

const STATUS_STYLE: Record<
  NonNullable<CaptionLine["status"]>,
  { label: string; color: string }
> = {
  confirmed: { label: "✅ CONFIRMED", color: "#1DB954" },
  "not-confirmed": { label: "❌ NOT CONFIRMED", color: "#E63946" },
  rumored: { label: "❓ RUMORED", color: "#F4A300" },
};

// ---------------------------------------------------------------------------
// One caption card, timed to its own start/end frame
// ---------------------------------------------------------------------------
const CaptionCard: React.FC<{ caption: CaptionLine; startFrame: number; durationFrames: number }> = ({
  caption,
  startFrame,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  const enter = spring({ frame: localFrame, fps: FPS, config: { damping: 18 } });
  const opacity = interpolate(localFrame, [0, 8, durationFrames - 8, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(enter, [0, 1], [40, 0]);

  const statusStyle = caption.status ? STATUS_STYLE[caption.status] : null;

  return (
    <div
      style={{
        position: "absolute",
        // YouTube Shorts always overlays channel name, description, and a
        // scrubber near the bottom (roughly the bottom 280-320px), plus
        // like/comment/share/remix buttons down the right edge (roughly the
        // right 110-130px). Placing captions here, in the vertical center,
        // keeps them clear of both zones regardless of device.
        top: "42%",
        left: 50,
        right: 140,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {statusStyle && (
        <div
          style={{
            display: "inline-block",
            background: statusStyle.color,
            color: "#0A0A0A",
            fontWeight: 800,
            fontSize: 34,
            padding: "10px 24px",
            borderRadius: 12,
            marginBottom: 18,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {statusStyle.label}
        </div>
      )}
      <div
        style={{
          fontSize: 54,
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1.25,
          textShadow: "0 4px 18px rgba(0,0,0,0.6)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {caption.text}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stock footage background — plays the Pexels clip fetched by
// fetch-background.ts, muted (voiceover is the only audio track), looped if
// shorter than the video, with a dark overlay so white caption text stays
// readable regardless of what's happening in the footage underneath.
// ---------------------------------------------------------------------------
const StockBackground: React.FC<{ videoPath: string; durationSeconds: number }> = ({
  videoPath,
  durationSeconds,
}) => {
  const { fps } = useVideoConfig();
  const loopDurationInFrames = Math.max(Math.round(durationSeconds * fps), 1);

  return (
    <AbsoluteFill>
      <Loop durationInFrames={loopDurationInFrames}>
        <OffthreadVideo
          src={staticFile(videoPath)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Loop>
      <AbsoluteFill style={{ background: "rgba(10, 15, 12, 0.55)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Background — animated gradient drift + slow-floating particles.
// Entirely generated (no external images/video), so there's no IP concern —
// this is original motion design, not a Rockstar asset. Used as a fallback
// when no stock footage clip is provided.
// ---------------------------------------------------------------------------
const PARTICLE_COUNT = 14;

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow gradient angle drift over the full video length, loops smoothly
  const angle = interpolate(frame, [0, durationInFrames], [150, 210], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, #0F1A14 0%, #14A078 140%)`,
      }}
    >
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        // Deterministic per-particle values from index, so render is reproducible
        const seed = i * 137.5;
        const startX = (seed % WIDTH);
        const driftSpeed = 6 + (i % 5) * 2; // px per frame-ish, varies per particle
        const size = 3 + (i % 4) * 2;
        const y = ((frame * driftSpeed + i * 400) % (HEIGHT + 200)) - 100;
        const opacity = 0.08 + (i % 3) * 0.04;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: startX,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "#FFFFFF",
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Watermark — small persistent channel mark, top-left, present the whole video.
// Swap the text/logo for your actual channel branding.
// ---------------------------------------------------------------------------
const Watermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 50,
      left: 40,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: "#FFFFFF25",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 800,
        color: "#FFFFFF",
      }}
    >
      ?
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFFCC", fontFamily: "Inter, sans-serif" }}>
      GTA6 Watch
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Progress bar so viewers can see how many facts are left — a small retention aid
// ---------------------------------------------------------------------------
const ProgressBar: React.FC<{ totalFrames: number }> = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const pct = interpolate(frame, [0, totalFrames], [0, 100], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "#00000040" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: "#FFFFFF" }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------
export const FactCheckShort: React.FC<FactCheckShortProps> = ({
  voiceover,
  backgroundVideoPath,
  backgroundVideoDurationSeconds,
}) => {
  const { fps } = useVideoConfig();
  const totalFrames = Math.round(voiceover.totalDurationSeconds * fps);

  return (
    <AbsoluteFill>
      {backgroundVideoPath ? (
        <StockBackground videoPath={backgroundVideoPath} durationSeconds={backgroundVideoDurationSeconds ?? 15} />
      ) : (
        <Background />
      )}
      <ProgressBar totalFrames={totalFrames} />
      <Watermark />

      {voiceover.captions.map((caption, i) => {
        const startFrame = Math.round(caption.startSeconds * fps);
        const endFrame = Math.round(caption.endSeconds * fps);
        const durationFrames = Math.max(endFrame - startFrame, 1);

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <CaptionCard caption={caption} startFrame={0} durationFrames={durationFrames} />
          </Sequence>
        );
      })}

      <Audio src={staticFile(voiceover.audioPath)} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Root registration (Root.tsx in a real Remotion project)
// ---------------------------------------------------------------------------
/*
import { Composition } from "remotion";
import { FactCheckShort, FPS, WIDTH, HEIGHT } from "./FactCheckShort";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FactCheckShort"
    component={FactCheckShort}
    durationInFrames={FPS * 90} // upper bound; actual render trims to voiceover length
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{
      script: undefined as any,     // supplied via --props at render time
      voiceover: undefined as any,
    }}
  />
);
*/

// ---------------------------------------------------------------------------
// Render command (run from your pipeline after voiceover completes):
//
//   npx remotion render FactCheckShort out/2026-07-09-short.mp4 \
//     --props='{"script": <DraftScript JSON>, "voiceover": <VoiceoverResult JSON>}'
//
// Output lands as a standard 1080x1920 mp4, ready for the YouTube upload step.
// ---------------------------------------------------------------------------
