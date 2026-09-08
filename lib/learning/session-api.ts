import type { FinalTranscriptMessage } from "@/lib/learning/types";
import type {
  SessionRecorderApi,
  SessionRecorderConfig,
} from "@/lib/learning/session-recorder";

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not persist learning session.");
  }
  return payload as T;
}

export const browserLearningSessionApi: SessionRecorderApi = {
  async createSession(
    config: SessionRecorderConfig,
    messages: FinalTranscriptMessage[],
  ) {
    const payload = await requestJson<{ sessionId: string }>("/api/learning/sessions", {
      method: "POST",
      body: JSON.stringify({ ...config, messages }),
    });
    return payload.sessionId;
  },

  async appendMessage(sessionId: string, message: FinalTranscriptMessage) {
    await requestJson(`/api/learning/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(message),
    });
  },

  async finalizeSession(sessionId: string) {
    return requestJson(`/api/learning/sessions/${sessionId}`, {
      method: "PATCH",
      body: "{}",
    });
  },
};
