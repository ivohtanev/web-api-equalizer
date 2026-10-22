import type { EqualizerApproach } from "./types";

export const response: EqualizerApproach = {
  id: "response",
  label: "Curve Headroom (Compensation)",
  description:
    "Reduces overall gain by the estimated peak of the combined EQ curve; not a peak limiter.",
  preampDb: (_, responsePeakDb) => -Math.max(0, responsePeakDb()),
};
