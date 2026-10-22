import { expect, it, vi } from "vitest";
import { createResponseMeter } from "./equalizer-response";
import { getApproach, parseApproach } from "../core/equalizer-approaches";

it("combines overlapping responses before finding the peak, including cuts", () => {
  const measured: number[][] = [];
  const responses = [
    [2, 1, 1],
    [2, 1, 1],
    [0.5, 1, 1],
  ];
  const analysis = responses.map((response) => ({
    gain: { value: 0 },
    frequency: { value: 0 },
    Q: { value: 0 },
    type: "",
    getFrequencyResponse(frequencies: Float32Array, magnitudes: Float32Array) {
      measured.push(Array.from(frequencies));
      magnitudes.fill(1);
      magnitudes.set(response);
    },
  }));
  const context = {
    sampleRate: 44100,
    createBiquadFilter: vi.fn(),
  };
  analysis.forEach((node) =>
    context.createBiquadFilter.mockReturnValueOnce(node),
  );
  const filters = [125, 250, 500].map((frequency) => ({
    type: "peaking",
    frequency: { value: frequency },
    Q: { value: 1.4 },
  }));
  const measure = createResponseMeter(
    context as unknown as AudioContext,
    filters as BiquadFilterNode[],
  );
  expect(measure([6, 6, -6])).toBeCloseTo(20 * Math.log10(2));
  expect(analysis.map((node) => node.gain.value)).toEqual([6, 6, -6]);
  expect(measured[0]).toEqual(
    expect.arrayContaining([0, 125, 250, 500, 22050]),
  );
  expect(
    measured[0]!.every((frequency) => frequency >= 0 && frequency <= 22050),
  ).toBe(true);
});

it("does not amplify cuts and only measures response for the curve approach", () => {
  const measure = vi.fn(() => -3);
  expect(getApproach("response").preampDb([-6], measure)).toBeCloseTo(0);
  measure.mockClear();
  expect(getApproach("direct").preampDb([12], measure)).toBe(0);
  expect(getApproach("compressor").preampDb([12], measure)).toBe(0);
  expect(parseApproach("conservative")).toBe("compressor");
  expect(measure).not.toHaveBeenCalled();
  expect(parseApproach(null)).toBe("compressor");
});
