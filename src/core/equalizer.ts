import type { EqualizerApproachId } from "./equalizer-approaches";
import type { EqualizerPresetId } from "./equalizer-presets";

export const EQ_FREQUENCIES = [
  31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];
export interface EqualizerState {
  /** Actual routing state, distinct from the persisted switch preference. */
  enabled: boolean;
  requestedEnabled: boolean;
  pending: boolean;
  gains: number[];
  preset: EqualizerPresetId;
  approach: EqualizerApproachId;
  preampDb: number;
  error: string;
}
export interface EqualizerPort {
  snapshot(): EqualizerState;
  setEnabled(enabled: boolean): Promise<void>;
  setGain(index: number, gain: number): void;
  setPreset(preset: EqualizerPresetId): void;
  setApproach(approach: EqualizerApproachId): void;
  reset(): void;
  subscribe(listener: (state: EqualizerState) => void): () => void;
}
