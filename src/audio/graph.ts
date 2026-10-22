import { EQ_FREQUENCIES } from "../core/equalizer";
import { getApproach } from "../core/equalizer-approaches";
import { configureCompressor } from "../core/equalizer-approaches/compressor";
import { createEqualizerProfile } from "../core/equalizer-presets";
import { createResponseMeter } from "./equalizer-response";
import type { Settings } from "../protocol";

/** A captured tab has one output path, including while changing gain approaches. */
export function createAudioGraph(context: AudioContext, stream: MediaStream) {
  const source = context.createMediaStreamSource(stream);
  const preamp = context.createGain();
  const filters = EQ_FREQUENCIES.map((frequency) => {
    const filter = context.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = Math.min(
      frequency,
      (context.sampleRate / 2) * 0.95,
    );
    filter.Q.value = 1.4;
    return filter;
  });
  const compressor = context.createDynamicsCompressor();
  configureCompressor(compressor);
  const responsePeakDb = createResponseMeter(context, filters);
  let tail: AudioNode = preamp;
  for (const filter of filters) {
    tail.connect(filter);
    tail = filter;
  }
  tail.connect(context.destination);
  source.connect(preamp);
  let compressed = false;
  return {
    apply(settings: Settings) {
      const gains = createEqualizerProfile(settings.profile).gains();
      const preampDb = getApproach(settings.approach).preampDb(gains, () =>
        responsePeakDb(gains),
      );
      const nextCompressed = settings.approach === "compressor";
      if (nextCompressed !== compressed) {
        tail.disconnect();
        compressor.disconnect();
        if (nextCompressed) {
          tail.connect(compressor);
          compressor.connect(context.destination);
        } else tail.connect(context.destination);
        compressed = nextCompressed;
      }
      preamp.gain.setTargetAtTime(
        10 ** (preampDb / 20),
        context.currentTime,
        0.02,
      );
      filters.forEach((filter, i) =>
        filter.gain.setTargetAtTime(gains[i]!, context.currentTime, 0.02),
      );
      return preampDb;
    },
  };
}
