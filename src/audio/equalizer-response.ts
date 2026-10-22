// Disconnected analysis nodes use the browser's own filter implementation and
// target gains, rather than the audible nodes' in-progress automation values.
export function createResponseMeter(
  context: AudioContext,
  filters: readonly BiquadFilterNode[],
) {
  const analysis = filters.map((filter) => {
    const node = context.createBiquadFilter();
    node.type = filter.type;
    node.frequency.value = filter.frequency.value;
    node.Q.value = filter.Q.value;
    return node;
  });
  const nyquist = context.sampleRate / 2;
  const frequencies = new Float32Array([
    0,
    ...Array.from(
      { length: 4097 },
      (_, i) => nyquist * (1 / nyquist) ** (1 - i / 4096),
    ),
    ...filters.map((filter) => filter.frequency.value),
  ]);
  const magnitudes = new Float32Array(frequencies.length);
  const phases = new Float32Array(frequencies.length);
  const combinedDb = new Float64Array(frequencies.length);
  return (gains: readonly number[]) => {
    combinedDb.fill(0);
    analysis.forEach((filter, band) => {
      filter.gain.value = gains[band] ?? 0;
      filter.getFrequencyResponse(frequencies, magnitudes, phases);
      magnitudes.forEach((magnitude, i) => {
        combinedDb[i] = combinedDb[i]! + 20 * Math.log10(magnitude);
      });
    });
    // Dense frequency sampling estimates the steady-state peak. It does not
    // bound time-domain transients or guarantee true-peak protection.
    return combinedDb.reduce((peak, value) => Math.max(peak, value), 0);
  };
}
