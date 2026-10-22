import { EQ_FREQUENCIES } from "./equalizer";

export type EqualizerPresetId = "user" | "music" | "podcast" | "movie";
export interface EqualizerProfile {
  preset: EqualizerPresetId;
  userGains: number[];
  presetGains: Record<Exclude<EqualizerPresetId, "user">, number[]>;
}

// Band order follows EQ_FREQUENCIES. Values are dB; tune these curves here.
// These are gentle starting points, independent of audio routing or website.
export const EQ_PRESETS = [
  { id: "user", label: "User", gains: null },
  { id: "music", label: "Music", gains: [2, 2, 1, 0, -1, 0, 1, 1.5, 2, 1] },
  {
    id: "podcast",
    label: "Podcast",
    gains: [-6, -4, -2, -1, 0, 1.5, 3, 2, 0, -2],
  },
  { id: "movie", label: "Movie", gains: [3, 2.5, 1.5, 0, -1, 0, 1.5, 2, 1, 0] },
] as const;

function parseGains(value: unknown) {
  return EQ_FREQUENCIES.map((_, i) =>
    Array.isArray(value) &&
    typeof value[i] === "number" &&
    Number.isFinite(value[i])
      ? Math.max(-12, Math.min(12, value[i]))
      : 0,
  );
}

/** Portable profile state. The host owns storage and applies the resulting gains. */
export function createEqualizerProfile(saved?: unknown, legacyGains?: unknown) {
  const record =
    saved && typeof saved === "object"
      ? (saved as Record<string, unknown>)
      : undefined;
  let preset: EqualizerPresetId =
    EQ_PRESETS.find((item) => item.id === record?.preset)?.id ?? "user";
  const userGains = parseGains(
    Array.isArray(record?.userGains) ? record.userGains : legacyGains,
  );
  const storedCurves =
    record?.presetGains && typeof record.presetGains === "object"
      ? (record.presetGains as Record<string, unknown>)
      : {};
  const curves = Object.fromEntries(
    EQ_PRESETS.map((item) => [
      item.id,
      item.id === "user"
        ? userGains
        : Array.isArray(storedCurves[item.id])
          ? parseGains(storedCurves[item.id])
          : [...item.gains!],
    ]),
  ) as Record<EqualizerPresetId, number[]>;
  return {
    snapshot(): EqualizerProfile {
      return {
        preset,
        userGains: [...curves.user],
        presetGains: {
          music: [...curves.music],
          podcast: [...curves.podcast],
          movie: [...curves.movie],
        },
      };
    },
    gains() {
      return [...curves[preset]];
    },
    select(value: EqualizerPresetId) {
      if (!EQ_PRESETS.some((item) => item.id === value) || value === preset)
        return false;
      preset = value;
      return true;
    },
    setGain(index: number, gain: number) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= userGains.length ||
        !Number.isFinite(gain)
      )
        return false;
      curves[preset][index] = Math.max(-12, Math.min(12, gain));
      return true;
    },
    reset() {
      const definition = EQ_PRESETS.find((item) => item.id === preset)!;
      curves[preset] = definition.gains
        ? [...definition.gains]
        : EQ_FREQUENCIES.map(() => 0);
      return true;
    },
  };
}
