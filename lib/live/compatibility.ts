export type CompatibilityIssue =
  | "insecure_context"
  | "media_devices"
  | "get_user_media"
  | "audio_context"
  | "audio_worklet";

export interface LiveCapabilities {
  secureContext: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;
  audioContext: boolean;
  audioWorklet: boolean;
}

export function checkLiveCompatibility(
  capabilities: LiveCapabilities,
): { supported: boolean; issues: CompatibilityIssue[] } {
  const issues: CompatibilityIssue[] = [];
  if (!capabilities.secureContext) issues.push("insecure_context");
  if (!capabilities.mediaDevices) issues.push("media_devices");
  if (!capabilities.getUserMedia) issues.push("get_user_media");
  if (!capabilities.audioContext) issues.push("audio_context");
  if (!capabilities.audioWorklet) issues.push("audio_worklet");
  return { supported: issues.length === 0, issues };
}

export function detectLiveCapabilities(): LiveCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      secureContext: false,
      mediaDevices: false,
      getUserMedia: false,
      audioContext: false,
      audioWorklet: false,
    };
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  return {
    secureContext: window.isSecureContext,
    mediaDevices: Boolean(navigator.mediaDevices),
    getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    audioContext: Boolean(AudioContextConstructor),
    audioWorklet:
      typeof AudioWorkletNode !== "undefined" &&
      Boolean(AudioContextConstructor?.prototype?.audioWorklet),
  };
}
