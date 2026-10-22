import type { EqualizerState } from "./core/equalizer";
import type {
  EqualizerPresetId,
  EqualizerProfile,
} from "./core/equalizer-presets";
import type { EqualizerApproachId } from "./core/equalizer-approaches";

export type Settings = {
  profile: EqualizerProfile;
  approach: EqualizerApproachId;
};
export type Command =
  | { type: "state" | "reset" }
  | { type: "enabled"; enabled: boolean }
  | { type: "gain"; index: number; gain: number }
  | { type: "preset"; preset: EqualizerPresetId }
  | { type: "approach"; approach: EqualizerApproachId };
export type Reply =
  { ok: true; state: EqualizerState } | { ok: false; error: string };
export type AudioStatus = { enabled: boolean; preampDb: number; error: string };
export type AudioCommand =
  | { type: "status"; tabId: number }
  | { type: "start"; tabId: number; streamId: string; settings: Settings }
  | { type: "stop"; tabId: number }
  | { type: "update"; settings: Settings };
export type AudioReply =
  { ok: true; status: AudioStatus } | { ok: false; error: string };
