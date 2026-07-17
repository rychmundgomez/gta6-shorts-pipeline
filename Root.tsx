// Root.tsx
// Registers the FactCheckShort composition so Remotion's CLI can find it.
// This is the missing piece — FactCheckShort.tsx defines the component,
// but Remotion needs this separate registration file to actually render it.

import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { FactCheckShort, FPS, WIDTH, HEIGHT, END_CARD_SECONDS, type FactCheckShortProps } from "./FactCheckShort";

// Computes the REAL duration from the actual voiceover length passed in via
// --props at render time, PLUS extra padding for the end card so it plays
// after captions finish rather than cutting the last one short.
const calculateMetadata: CalculateMetadataFunction<FactCheckShortProps> = ({ props }) => {
  const voiceoverFrames = Math.round((props.voiceover?.totalDurationSeconds ?? 90) * FPS);
  const endCardFrames = Math.round(END_CARD_SECONDS * FPS);
  const durationInFrames = Math.max(voiceoverFrames + endCardFrames, FPS * 3);
  return { durationInFrames };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FactCheckShort"
      component={FactCheckShort}
      calculateMetadata={calculateMetadata}
      durationInFrames={FPS * 90} // fallback only — calculateMetadata overrides this at render time
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      // defaultProps are overridden by whatever --props JSON you pass at render time
      defaultProps={{
        script: {
          weekOf: "",
          hook: "",
          bullets: [],
          close: "",
          estimatedSeconds: 0,
          rawModelOutput: "",
        },
        voiceover: {
          weekOf: "",
          audioPath: "",
          captions: [],
          totalDurationSeconds: 0,
        },
        backgroundVideoPath: undefined,
        backgroundVideoDurationSeconds: undefined,
      }}
    />
  );
};
