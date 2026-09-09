export type TutorErrorCode =
  | "microphone_permission_denied"
  | "microphone_not_found"
  | "microphone_unavailable"
  | "unsupported_browser"
  | "audio_context_failed"
  | "audio_worklet_failed"
  | "audio_decode_failed"
  | "network"
  | "token"
  | "provider"
  | "session_timeout"
  | "usage_limit"
  | "session_closed"
  | "unknown";

export type LiveFailurePhase =
  | "microphone"
  | "audio-context"
  | "audio-worklet"
  | "token"
  | "provider"
  | "unknown";

export function classifyLiveFailure(
  reason: unknown,
  phase: LiveFailurePhase,
): TutorErrorCode {
  if (phase === "microphone" && reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "SecurityError") {
      return "microphone_permission_denied";
    }
    if (reason.name === "NotFoundError" || reason.name === "OverconstrainedError") {
      return "microphone_not_found";
    }
    if (
      reason.name === "NotReadableError" ||
      reason.name === "AbortError"
    ) {
      return "microphone_unavailable";
    }
  }

  if (phase === "audio-context") return "audio_context_failed";
  if (phase === "audio-worklet") return "audio_worklet_failed";
  if (phase === "provider") return "provider";
  if (phase === "token") {
    return reason instanceof TypeError ? "network" : "token";
  }
  return "unknown";
}

const RETRYABLE = new Set<TutorErrorCode>([
  "network",
  "token",
  "provider",
  "session_closed",
]);

export function isRetryableTutorError(code: TutorErrorCode): boolean {
  return RETRYABLE.has(code);
}

const COPY: Record<TutorErrorCode, string> = {
  microphone_permission_denied:
    "Microphone permission is blocked. Enable microphone access for this site, then try again.",
  microphone_not_found:
    "No microphone was found. Connect a microphone and try again.",
  microphone_unavailable:
    "Your microphone is unavailable. Check system input settings or close another app using it.",
  unsupported_browser:
    "Your browser is missing features required for live voice practice.",
  audio_context_failed:
    "Audio could not be started in this browser. Try again after interacting with the page.",
  audio_worklet_failed:
    "The microphone audio processor could not be loaded.",
  audio_decode_failed:
    "A tutor audio response could not be played.",
  network:
    "The network connection failed. Check your connection and try again.",
  token:
    "Talk Tutor could not authorize a live session. Please try again.",
  provider:
    "The live tutor provider connection failed. Please try again.",
  session_timeout:
    "This live practice session reached its supported session limit. Your progress was saved.",
  usage_limit:
    "You have used your conversation allowance for this billing period. Upgrade or wait for the next period.",
  session_closed:
    "The live tutor session ended. You can try again.",
  unknown:
    "The live tutor could not start. Please try again.",
};

export function tutorErrorMessage(code: TutorErrorCode): string {
  return COPY[code];
}
