import { describe, expect, it, vi } from "vitest";
import { createAudioGraph } from "./graph";
import { createEqualizerProfile } from "../core/equalizer-presets";

function fixture() {
  const nodes: any[] = [];
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => {
    const value = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: parameter(),
      frequency: parameter(),
      Q: parameter(),
      threshold: parameter(),
      knee: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
      getFrequencyResponse: vi.fn((_frequencies, magnitudes) =>
        magnitudes.fill(1),
      ),
    };
    nodes.push(value);
    return value;
  };
  const context = {
    currentTime: 7,
    sampleRate: 32000,
    destination: {},
    createMediaStreamSource: vi.fn(node),
    createGain: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createDynamicsCompressor: vi.fn(node),
  };
  const graph = createAudioGraph(
    context as unknown as AudioContext,
    {} as MediaStream,
  );
  return { context, graph, nodes };
}
describe("captured tab audio graph", () => {
  it("routes one source through ten filters and never recreates it on updates", () => {
    const { graph, context } = fixture();
    graph.apply({
      profile: createEqualizerProfile().snapshot(),
      approach: "direct",
    });
    graph.apply({
      profile: createEqualizerProfile().snapshot(),
      approach: "response",
    });
    expect(context.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(context.createBiquadFilter).toHaveBeenCalledTimes(20);
    expect(
      context.createBiquadFilter.mock.results[9]!.value.frequency.value,
    ).toBe(15200);
    expect(
      context.createGain.mock.results[0]!.value.gain.setTargetAtTime,
    ).toHaveBeenLastCalledWith(1, 7, 0.02);
  });
  it("routes the compressor only in compressor mode and smooths saved preset gains", () => {
    const { graph, context } = fixture();
    const profile = createEqualizerProfile();
    profile.select("music");
    graph.apply({ profile: profile.snapshot(), approach: "compressor" });
    const compressor = context.createDynamicsCompressor.mock.results[0]!.value;
    const tail = context.createBiquadFilter.mock.results[9]!.value;
    expect(tail.connect).toHaveBeenLastCalledWith(compressor);
    expect(compressor.connect).toHaveBeenCalledWith(context.destination);
    expect(
      context.createBiquadFilter.mock.results[0]!.value.gain.setTargetAtTime,
    ).toHaveBeenCalledWith(2, 7, 0.02);
    graph.apply({ profile: profile.snapshot(), approach: "direct" });
    expect(compressor.disconnect).toHaveBeenCalledTimes(2);
    expect(tail.connect).toHaveBeenLastCalledWith(context.destination);
  });
});
