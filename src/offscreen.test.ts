import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AudioCommand, AudioReply } from "./protocol";
import { createEqualizerProfile } from "./core/equalizer-presets";

const graph = vi.hoisted(() => ({ apply: vi.fn(() => -2) }));
vi.mock("./audio/graph", () => ({ createAudioGraph: () => graph }));
let listener: (...args: any[]) => any;
let stream: any;
let track: any;
let context: any;
let getUserMedia: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
const settings = {
  profile: createEqualizerProfile().snapshot(),
  approach: "response" as const,
};
beforeEach(async () => {
  vi.resetModules();
  track = { readyState: "live", stop: vi.fn(), addEventListener: vi.fn() };
  stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  getUserMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  context = {
    state: "running",
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  notify = vi.fn(async () => {});
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: notify,
      onMessage: {
        addListener: (value: any) => {
          listener = value;
        },
      },
    },
  });
  await import("./offscreen");
});
afterEach(() => {
  vi.useRealTimers();
});
function request(command: AudioCommand): Promise<AudioReply> {
  return new Promise((resolve) =>
    listener({ target: "offscreen", command }, { id: "test" }, resolve),
  );
}
it("keeps processing independently of popup lifetime and cleans up OFF", async () => {
  expect(
    (await request({ type: "start", tabId: 1, streamId: "stream", settings }))
      .ok,
  ).toBe(true);
  expect(getUserMedia).toHaveBeenCalledWith({
    audio: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: "stream" },
    },
    video: false,
  });
  expect(await request({ type: "status", tabId: 1 })).toEqual({
    ok: true,
    status: { enabled: true, preampDb: -2, error: "" },
  });
  await request({ type: "update", settings });
  expect(graph.apply).toHaveBeenCalledWith(settings);
  await request({ type: "stop", tabId: 1 });
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(context.close).toHaveBeenCalledTimes(1);
});
it("releases failed starts and allows a retry", async () => {
  context.resume.mockRejectedValueOnce(new Error("Resume failed"));
  expect(
    (await request({ type: "start", tabId: 1, streamId: "stream", settings }))
      .ok,
  ).toBe(false);
  expect(track.stop).toHaveBeenCalled();
  expect(context.close).toHaveBeenCalled();
  expect(
    (await request({ type: "start", tabId: 1, streamId: "stream", settings }))
      .ok,
  ).toBe(true);
});
it("cleans up an ended track and notifies the service worker", async () => {
  await request({ type: "start", tabId: 1, streamId: "stream", settings });
  const ended = track.addEventListener.mock.calls.find(
    (call: any[]) => call[0] === "ended",
  )[1];
  ended();
  expect(notify).toHaveBeenCalledWith({
    target: "background",
    event: "ended",
    tabId: 1,
  });
  expect(await request({ type: "status", tabId: 1 })).toEqual({
    ok: true,
    status: { enabled: false, preampDb: 0, error: "" },
  });
});
it("times out a hung capture and stops tracks if acquisition completes late", async () => {
  vi.useFakeTimers();
  let resolveStream: (value: any) => void = () => {};
  getUserMedia.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveStream = resolve;
      }),
  );
  const result = request({
    type: "start",
    tabId: 1,
    streamId: "stream",
    settings,
  });
  await vi.advanceTimersByTimeAsync(10001);
  expect((await result).ok).toBe(false);
  resolveStream(stream);
  await vi.advanceTimersByTimeAsync(0);
  expect(track.stop).toHaveBeenCalled();
});
