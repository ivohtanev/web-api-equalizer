import { createEqualizerProfile } from "./core/equalizer-presets";
import { parseApproach } from "./core/equalizer-approaches";
import type {
  AudioCommand,
  AudioReply,
  AudioStatus,
  Command,
  Reply,
  Settings,
} from "./protocol";

let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job);
  queue = result.catch(() => {});
  return result;
}
async function hasAudioDocument() {
  return (
    (
      await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      })
    ).length > 0
  );
}
async function ensureAudioDocument() {
  if (await hasAudioDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification:
      "Process and play the audio of tabs explicitly enabled by the user.",
  });
}
async function audio(command: AudioCommand): Promise<AudioStatus> {
  const reply: AudioReply = await chrome.runtime.sendMessage({
    target: "offscreen",
    command,
  });
  if (!reply?.ok)
    throw new Error(
      reply?.error || "Audio engine is unavailable. Try enabling EQ again.",
    );
  return reply.status;
}
async function badge(tabId: number, enabled: boolean) {
  await chrome.action
    .setBadgeText({ tabId, text: enabled ? "ON" : "" })
    .catch(() => {});
  await chrome.action
    .setBadgeBackgroundColor({ tabId, color: "#397957" })
    .catch(() => {});
}
async function handle(tabId: number, command: Command): Promise<Reply> {
  if (!Number.isInteger(tabId) || tabId < 0)
    throw new Error("No active browser tab.");
  const saved = await chrome.storage.local.get(["profile", "approach"]);
  const profile = createEqualizerProfile(saved.profile);
  let approach = parseApproach(saved.approach);
  let edited = false;
  if (command.type === "gain")
    edited = profile.setGain(command.index, command.gain);
  if (command.type === "preset") edited = profile.select(command.preset);
  if (command.type === "reset") edited = profile.reset();
  if (command.type === "approach") {
    approach = parseApproach(command.approach);
    edited = true;
  }
  const settings: Settings = { profile: profile.snapshot(), approach };
  if (edited) {
    await chrome.storage.local.set(settings);
    if (await hasAudioDocument()) await audio({ type: "update", settings });
  }
  if (command.type === "enabled" || edited) {
    if (command.type !== "enabled" || command.enabled) {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || !/^(https?|file):/i.test(tab.url))
        throw new Error(
          "Open a regular website tab to use the equalizer. Browser settings and protected pages cannot be captured.",
        );
      await ensureAudioDocument();
      const current = await audio({ type: "status", tabId });
      if (!current.enabled) {
        await audio({ type: "stop", tabId });
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tabId,
        });
        await audio({ type: "start", tabId, streamId, settings });
      }
    } else if (await hasAudioDocument()) await audio({ type: "stop", tabId });
  }
  const status: AudioStatus = (await hasAudioDocument())
    ? await audio({ type: "status", tabId })
    : { enabled: false, preampDb: 0, error: "" };
  await badge(tabId, status.enabled);
  return {
    ok: true,
    state: {
      ...status,
      requestedEnabled: status.enabled,
      pending: false,
      gains: profile.gains(),
      preset: settings.profile.preset,
      approach,
    },
  };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target !== "background")
    return;
  if (message.event === "ended") {
    void badge(message.tabId, false);
    return;
  }
  // Content scripts and web pages cannot send EQ commands.
  if (sender.url !== chrome.runtime.getURL("popup.html")) return;
  void enqueue(() => handle(message.tabId, message.command)).then(
    respond,
    (error) =>
      respond({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void enqueue(async () => {
    if (await hasAudioDocument()) await audio({ type: "stop", tabId });
  }).catch(() => {});
});
