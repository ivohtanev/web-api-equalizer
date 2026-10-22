import { expect, it } from "vitest";
import { EQ_FREQUENCIES } from "./equalizer";
import { createEqualizerProfile, EQ_PRESETS } from "./equalizer-presets";

it("migrates legacy gains into User and validates persisted values", () => {
  const profile = createEqualizerProfile(undefined, [6, -3, NaN, 90, -90, "4"]);
  expect(profile.snapshot()).toMatchObject({
    preset: "user",
    userGains: [6, -3, 0, 12, -12, 0, 0, 0, 0, 0],
  });
  expect(
    createEqualizerProfile(
      { preset: "unknown", userGains: [2] },
      [6],
    ).gains()[0],
  ).toBe(2);
  expect(
    createEqualizerProfile(
      { preset: "music", userGains: "bad" },
      [6],
    ).snapshot().userGains[0],
  ).toBe(6);
});

it("saves each edited preset independently across reload and restores only its defaults", () => {
  const profile = createEqualizerProfile(undefined, [4, -2]);
  for (const preset of EQ_PRESETS.slice(1)) {
    profile.select(preset.id);
    expect(profile.gains()).toEqual(preset.gains);
    expect(profile.setGain(0, 7.3)).toBe(true);
  }
  const restored = createEqualizerProfile(profile.snapshot());
  for (const preset of EQ_PRESETS.slice(1)) {
    restored.select(preset.id);
    expect(restored.gains()[0]).toBe(7.3);
    restored.reset();
    expect(restored.gains()).toEqual(preset.gains);
  }
  restored.select("user");
  expect(restored.gains().slice(0, 2)).toEqual([4, -2]);
  restored.reset();
  expect(restored.gains()).toEqual(Array(10).fill(0));
  profile.select("music");
  expect(profile.gains()[0]).toBe(7.3);
});

it("validates saved custom curves and rejects invalid edits", () => {
  const profile = createEqualizerProfile({
    preset: "music",
    presetGains: {
      music: [NaN, Infinity, -99, 99, "3"],
      podcast: "bad",
    },
  });
  expect(profile.gains()).toEqual([0, 0, -12, 12, 0, 0, 0, 0, 0, 0]);
  for (const [index, gain] of [
    [-1, 1],
    [10, 1],
    [0.5, 1],
    [0, NaN],
  ]) {
    expect(profile.setGain(index!, gain!)).toBe(false);
  }
  profile.snapshot().presetGains.music.fill(3);
  expect(profile.gains()[0]).toBe(0);
  profile.select("podcast");
  expect(profile.gains()).toEqual(EQ_PRESETS[2].gains);
});

it("keeps preset definitions intact and snapshots detached", () => {
  const profile = createEqualizerProfile({ preset: "movie", userGains: [3] });
  profile.gains().fill(12);
  profile.snapshot().userGains.fill(-12);
  expect(profile.gains()).toEqual(EQ_PRESETS[3].gains);
  expect(profile.snapshot().userGains[0]).toBe(3);
  for (const preset of EQ_PRESETS.slice(1)) {
    expect(preset.gains).toHaveLength(EQ_FREQUENCIES.length);
    expect(
      preset.gains?.every(
        (gain) =>
          Number.isFinite(gain) && Math.abs(gain) <= 12 && gain % 0.5 === 0,
      ),
    ).toBe(true);
  }
});
