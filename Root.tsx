// Root.tsx
// Registers the FactCheckShort composition so Remotion's CLI can find it.
// This is the missing piece — FactCheckShort.tsx defines the component,
// but Remotion needs this separate registration file to actually render it.

import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { FactCheckShort, FPS, WIDTH, HEIGHT, type FactCheckShortProps } from "./FactCheckShort";

// Computes the REAL duration from the actual voiceover length passed in via
// --props at render time — this is what was missing before, which is why
// every render defaulted to the full 90-second upper bound regardless of
// how long the voiceover actually was.
const calculateMetadata: CalculateMetadataFunction<FactCheckShortProps> = ({ props }) => {
  const durationInFrames = Math.max(
    Math.round((props.voiceover?.totalDurationSeconds ?? 90) * FPS),
    FPS * 3 // safety floor so a malformed 0-second input doesn't render an empty video
  );
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
