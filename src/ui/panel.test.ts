import { beforeEach, expect, it, vi } from "vitest";
import { mountPanel } from "./panel";
import { createEqualizerProfile } from "../core/equalizer-presets";
import type { EqualizerPort, EqualizerState } from "../core/equalizer";
beforeEach(() => {
  document.body.replaceChildren();
});
it("opens the complete EQ directly and binds switches, presets, sliders and wheel", () => {
  const state: EqualizerState = {
    enabled: false,
    requestedEnabled: false,
    pending: false,
    gains: createEqualizerProfile().gains(),
    preset: "user",
    approach: "compressor",
    preampDb: 0,
    error: "",
  };
  const port: EqualizerPort = {
    snapshot: () => state,
    setEnabled: vi.fn(async () => {}),
    setGain: vi.fn(),
    setPreset: vi.fn(),
    setApproach: vi.fn(),
    reset: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  };
  mountPanel(document.body, port);
  expect(document.body.textContent).toContain("Web API Equalizer");
  expect(document.querySelectorAll("input[type=range]")).toHaveLength(10);
  expect(document.querySelector(".eq-panel")?.hasAttribute("hidden")).toBe(
    false,
  );
  document.querySelector<HTMLButtonElement>("[role=switch]")!.click();
  expect(port.setEnabled).toHaveBeenCalledWith(true);
  const slider = document.querySelector<HTMLInputElement>("input")!;
  slider.value = "3.5";
  slider.dispatchEvent(new Event("input"));
  expect(port.setGain).toHaveBeenCalledWith(0, 3.5);
  slider.dispatchEvent(
    new WheelEvent("wheel", { deltaY: -1, cancelable: true }),
  );
  expect(port.setGain).toHaveBeenLastCalledWith(0, 0.2);
  const calls = vi.mocked(port.setGain).mock.calls.length;
  slider.dispatchEvent(
    new WheelEvent("wheel", { deltaY: -1, ctrlKey: true, cancelable: true }),
  );
  expect(port.setGain).toHaveBeenCalledTimes(calls);
  document
    .querySelectorAll<HTMLButtonElement>(".eq-presets button")[1]!
    .click();
  expect(port.setPreset).toHaveBeenCalledWith("music");
});
