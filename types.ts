import type { PracticeConfiguration } from "@/lib/learning/practice";
import type { TranscriptEvent } from "@/lib/live/transcript";

export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  REQUESTING_PERMISSION = "REQUESTING_PERMISSION",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  DISCONNECTING = "DISCONNECTING",
  ERROR = "ERROR",
}

export type AgentState = "thinking" | "listening" | "talking" | null;

export interface AudioVolume {
  input: number;
  output: number;
}

export type LiveConversationErrorCode =
  | "microphone_permission_denied"
  | "microphone_unavailable"
  | "live_connection_failed"
  | "audio_worklet_failed"
  | "audio_decode_failed"
  | "session_closed"
  | "unknown";

export interface LiveConversationError {
  code: LiveConversationErrorCode;
  message: string;
}

export interface LiveManagerCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onTranscriptEvent: (event: TranscriptEvent) => void;
  onAudioLevel: (level: number, type: "input" | "output") => void;
  onAgentState: (state: AgentState) => void;
  onError: (error: LiveConversationError) => void;
  onSessionClosed?: (reason?: string) => void;
}

export interface ConnectConfig {
  selected_topic: string;
  description: string;

  selected_launguage_name: string;
  selected_launguage_code: string;
  selected_launguage_region: string;

  context: string;
  selected_proefficent_level: string;
  selected_assistant_voice: string;
  input_device_id?: string;
  practice_config: PracticeConfiguration;
}
