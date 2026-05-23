import { RunEvent } from "./types";

export type RunEventHandler = (ev: RunEvent) => void;
export type EndHandler = () => void;

export function openRunStream(
  runId: string,
  onEvent: RunEventHandler,
  onEnd?: EndHandler,
  onError?: (e: Error) => void,
): () => void {
  const url = `/api/v1/run/${runId}/stream`;
  const es = new EventSource(url);

  es.onmessage = (m) => {
    try {
      const parsed = RunEvent.parse(JSON.parse(m.data));
      onEvent(parsed);
      if (parsed.stage === "run" && (parsed.event === "complete" || parsed.event === "error")) {
        es.close();
        onEnd?.();
      }
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  es.addEventListener("end", () => {
    es.close();
    onEnd?.();
  });

  es.onerror = () => {
    // EventSource will auto-reconnect on transient errors. Surface only on close.
    if (es.readyState === EventSource.CLOSED) {
      onError?.(new Error("SSE connection closed"));
      onEnd?.();
    }
  };

  return () => es.close();
}
