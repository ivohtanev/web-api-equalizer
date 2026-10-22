import { createAudioGraph } from "./audio/graph";
import type { AudioCommand, AudioReply, AudioStatus } from "./protocol";

type Session = {
  stream: MediaStream;
  context: AudioContext;
  graph: ReturnType<typeof createAudioGraph>;
  preampDb: number;
};
const sessions = new Map<number, Session>();
const inactive: AudioStatus = { enabled: false, preampDb: 0, error: "" };
function status(tabId: number): AudioStatus {
  const session = sessions.get(tabId);
  return session
    ? {
        enabled: session.context.state === "running",
        preampDb: session.preampDb,
        error:
          session.context.state === "running"
            ? ""
            : "Audio processing paused. Turn EQ off and on to retry.",
      }
    : inactive;
}
async function stop(tabId: number) {
  const session = sessions.get(tabId);
  if (!session) return;
  sessions.delete(tabId);
  session.stream.getTracks().forEach((track) => track.stop());
  await session.context.close().catch(() => {});
}
async function handle(command: AudioCommand): Promise<AudioReply> {
  if (command.type === "status")
    return { ok: true, status: status(command.tabId) };
  if (command.type === "stop") {
    await stop(command.tabId);
    return { ok: true, status: inactive };
  }
  if (command.type === "update") {
    sessions.forEach((session) => {
      session.preampDb = session.graph.apply(command.settings);
    });
    return { ok: true, status: inactive };
  }
  if (sessions.has(command.tabId))
    return { ok: true, status: status(command.tabId) };
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: command.streamId,
        },
      },
      video: false,
    };
    const acquisition = navigator.mediaDevices
      .getUserMedia(constraints as MediaStreamConstraints)
      .then((value) => {
        if (expired) {
          value.getTracks().forEach((track) => track.stop());
          throw new Error("Tab audio activation timed out.");
        }
        return value;
      });
    stream = await Promise.race([
      acquisition,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(
            new Error("Tab audio activation timed out. Try enabling EQ again."),
          );
        }, 10000);
      }),
    ]);
    clearTimeout(timer);
    if (!stream.getAudioTracks().some((track) => track.readyState === "live"))
      throw new Error("This tab did not provide an audio stream.");
    context = new AudioContext();
    const graph = createAudioGraph(context, stream);
    const preampDb = graph.apply(command.settings);
    await Promise.race([
      context.resume(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error("Audio output did not start. Try enabling EQ again."),
            ),
          10000,
        );
      }),
    ]);
    if (context.state !== "running")
      throw new Error("Audio output did not start.");
    const session: Session = { stream, context, graph, preampDb };
    sessions.set(command.tabId, session);
    const ended = () => {
      if (sessions.get(command.tabId) !== session) return;
      void stop(command.tabId);
      void chrome.runtime
        .sendMessage({
          target: "background",
          event: "ended",
          tabId: command.tabId,
        })
        .catch(() => {});
    };
    stream
      .getAudioTracks()
      .forEach((track) =>
        track.addEventListener("ended", ended, { once: true }),
      );
    return { ok: true, status: status(command.tabId) };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    await context?.close().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target !== "offscreen")
    return;
  void handle(message.command).then(respond, (error) =>
    respond({ ok: false, error: String(error) }),
  );
  return true;
});
