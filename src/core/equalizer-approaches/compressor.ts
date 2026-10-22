import type { EqualizerApproach } from "./types";

export const compressor: EqualizerApproach = {
  id: "compressor",
  label: "Boost + Compressor",
  description:
    "Boosts bands and compresses loud peaks. Can reduce the whole mix on strong bass hits and adds a little latency. Not a guaranteed clipping or true-peak limiter.",
  preampDb: () => 0,
};

export function configureCompressor(node: DynamicsCompressorNode) {
  node.threshold.value = -3;
  node.knee.value = 0;
  node.ratio.value = 20;
  node.attack.value = 0.003;
  node.release.value = 0.15;
}
