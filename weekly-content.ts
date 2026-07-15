// weekly-content.ts
// Update this file each week with real, sourced GTA 6 news before the
// scheduled run — this is the actual research step, still manual.

import type { ScriptRequest } from "./generate-script";

export const testRequestForCI: ScriptRequest = {
  weekOf: "2026-07-14", // update to the current week
  newsItems: [
    // Add real NewsItem entries here — see content-schema.ts for the shape
  ],
  factUpdates: [
    // Add real FactEntry entries here
  ],
};