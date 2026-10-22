import { response } from "./response";
import { direct } from "./direct";
import { compressor } from "./compressor";

export const EQ_APPROACHES = [compressor, direct, response];
export type EqualizerApproachId = (typeof EQ_APPROACHES)[number]["id"];
export const DEFAULT_EQ_APPROACH: EqualizerApproachId = "compressor";

export function parseApproach(value: unknown): EqualizerApproachId {
  return (
    EQ_APPROACHES.find((approach) => approach.id === value)?.id ??
    DEFAULT_EQ_APPROACH
  );
}

export function getApproach(id: EqualizerApproachId) {
  return EQ_APPROACHES.find((approach) => approach.id === id)!;
}
