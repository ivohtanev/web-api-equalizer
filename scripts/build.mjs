import { build } from "esbuild";
import { mkdir, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: {
    popup: "src/popup.ts",
    background: "src/background.ts",
    offscreen: "src/offscreen.ts",
  },
  bundle: true,
  format: "esm",
  target: "chrome116",
  outdir: "dist",
});
console.log("Load dist/ as an unpacked extension in Chrome, Edge or Brave.");
