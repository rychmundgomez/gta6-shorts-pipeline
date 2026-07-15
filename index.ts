// index.ts
// Remotion's actual entry point — the CLI loads this file first, which
// registers the Root, which in turn registers the FactCheckShort composition.

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
