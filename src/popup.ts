import "./ui/popup.css";
import { mountPanel } from "./ui/panel";
import { createEqualizerProfile } from "./core/equalizer-presets";
import { parseApproach } from "./core/equalizer-approaches";
import type { EqualizerState, EqualizerPort } from "./core/equalizer";
import type { Command, Reply } from "./protocol";
const app = document.querySelector<HTMLElement>("#app")!;
let tabId: number;
let state: EqualizerState = {
  enabled: false,
  requestedEnabled: false,
  pending: false,
  gains: createEqualizerProfile().gains(),
  preset: "user",
  approach: parseApproach(undefined),
  preampDb: 0,
  error: "",
};
const listeners = new Set<(state: EqualizerState) => void>();
let pendingCommands = 0;
const emit = () => listeners.forEach((listener) => listener(state));
async function command(command: Command) {
  pendingCommands++;
  try {
    const reply: Reply = await chrome.runtime.sendMessage({
      target: "background",
      tabId,
      command,
    });
    if (!reply.ok) throw new Error(reply.error);
    state = reply.state;
  } catch (error) {
    state = {
      ...state,
      pending: false,
      requestedEnabled: state.enabled,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  pendingCommands--;
  emit();
}
const port: EqualizerPort = {
  snapshot: () => structuredClone(state),
  async setEnabled(enabled) {
    state = { ...state, pending: true, requestedEnabled: enabled, error: "" };
    emit();
    await command({ type: "enabled", enabled });
  },
  setGain: (index, gain) => {
    void command({ type: "gain", index, gain });
  },
  setPreset: (preset) => {
    void command({ type: "preset", preset });
  },
  setApproach: (approach) => {
    void command({ type: "approach", approach });
  },
  reset: () => {
    void command({ type: "reset" });
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  },
};
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error("No active browser tab.");
  tabId = tab.id;
  await command({ type: "state" });
  mountPanel(app, port);
  // Refresh stream-ended or suspended status while the popup remains visible.
  setInterval(() => {
    if (pendingCommands === 0 && !state.error) void command({ type: "state" });
  }, 1000);
}
void init().catch((error) => {
  app.textContent = String(error);
});
