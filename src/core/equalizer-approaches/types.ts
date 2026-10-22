export interface EqualizerApproach {
  id: "response" | "direct" | "compressor";
  label: string;
  description: string;
  preampDb(gains: readonly number[], responsePeakDb: () => number): number;
}
