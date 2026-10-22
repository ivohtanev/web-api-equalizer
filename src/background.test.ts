import { beforeEach, expect, it, vi } from "vitest";
import type { Command, Reply } from "./protocol";

let listener: (...args: any[]) => any;
let removed: (tabId: number) => void;
let documentOpen: boolean;
let saved: Record<string, unknown>;
let sessions: Set<number>;
let api: any;
beforeEach(async () => {
  vi.resetModules();
  documentOpen = false;
  saved = {};
  sessions = new Set();
  api = {
    runtime: {
      id: "test",
      ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
      getURL: (path: string) => `chrome-extension://test/${path}`,
      getContexts: vi.fn(async () => (documentOpen ? [{}] : [])),
      onMessage: {
        addListener: vi.fn((value) => {
          listener = value;
        }),
      },
      sendMessage: vi.fn(async ({ command }) => {
        if (command.type === "start") sessions.add(command.tabId);
        if (command.type === "stop") sessions.delete(command.tabId);
        return {
          ok: true,
          status: {
            enabled: sessions.has(command.tabId),
            preampDb: 0,
            error: "",
          },
        };
      }),
    },
    offscreen: {
      Reason: { USER_MEDIA: "USER_MEDIA" },
      createDocument: vi.fn(async () => {
        documentOpen = true;
      }),
    },
    storage: {
      local: {
        get: vi.fn(async () => saved),
        set: vi.fn(async (value) => {
          saved = structuredClone(value);
        }),
      },
    },
    tabCapture: { getMediaStreamId: vi.fn(async () => "stream") },
    tabs: {
      get: vi.fn(async () => ({ url: "https://example.com/" })),
      onRemoved: {
        addListener: vi.fn((value) => {
          removed = value;
        }),
      },
    },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setBadgeBackgroundColor: vi.fn(async () => {}),
    },
  };
  vi.stubGlobal("chrome", api);
  await import("./background");
});
function request(tabId: number, command: Command): Promise<Reply> {
  return new Promise((resolve) =>
    listener(
      { target: "background", tabId, command },
      { id: "test", url: "chrome-extension://test/popup.html" },
      resolve,
    ),
  );
}
it("opening the popup does not capture and starts OFF", async () => {
  const reply = await request(1, { type: "state" });
  expect(reply.ok && reply.state.enabled).toBe(false);
  expect(api.tabCapture.getMediaStreamId).not.toHaveBeenCalled();
});
it("starts separate tab streams, reuses the offscreen document and releases only the disabled tab", async () => {
  await request(1, { type: "enabled", enabled: true });
  await request(1, { type: "enabled", enabled: true });
  await request(2, { type: "enabled", enabled: true });
  expect(api.tabCapture.getMediaStreamId).toHaveBeenCalledTimes(2);
  expect(api.offscreen.createDocument).toHaveBeenCalledTimes(1);
  await request(1, { type: "enabled", enabled: false });
  expect(sessions.has(1)).toBe(false);
  expect(sessions.has(2)).toBe(true);
});
it("serializes simultaneous edits and shares saved settings with active graphs", async () => {
  await request(1, { type: "enabled", enabled: true });
  await Promise.all([
    request(1, { type: "gain", index: 0, gain: 3 }),
    request(1, { type: "gain", index: 1, gain: -4 }),
  ]);
  const reply = await request(2, { type: "state" });
  expect(reply.ok && reply.state.gains.slice(0, 2)).toEqual([3, -4]);
  expect(api.runtime.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      command: expect.objectContaining({ type: "update" }),
    }),
  );
});
it("reports restricted pages and failed capture without claiming ON", async () => {
  api.tabs.get.mockResolvedValueOnce({ url: "chrome://settings" });
  expect((await request(1, { type: "enabled", enabled: true })).ok).toBe(false);
  api.tabCapture.getMediaStreamId.mockRejectedValueOnce(
    new Error("Capture denied"),
  );
  expect(await request(1, { type: "enabled", enabled: true })).toEqual({
    ok: false,
    error: "Capture denied",
  });
  const reply = await request(1, { type: "state" });
  expect(reply.ok && reply.state.enabled).toBe(false);
});
it("releases a closed tab and ignores commands from content scripts", async () => {
  await request(1, { type: "enabled", enabled: true });
  removed(1);
  await request(2, { type: "state" });
  expect(sessions.has(1)).toBe(false);
  const respond = vi.fn();
  expect(
    listener(
      {
        target: "background",
        tabId: 2,
        command: { type: "enabled", enabled: true },
      },
      { id: "test", tab: { id: 2 }, url: "https://example.com" },
      respond,
    ),
  ).toBeUndefined();
  expect(respond).not.toHaveBeenCalled();
});
