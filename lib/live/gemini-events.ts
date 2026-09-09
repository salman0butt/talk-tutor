import {
  InteractionStatus,
  type LiveServerMessage,
  VoiceActivityType,
} from "@google/genai";
import type { TranscriptEvent } from "./transcript";

export interface NormalizedGeminiMessage {
  transcriptEvents: TranscriptEvent[];
  audioChunks: string[];
  interrupted: boolean;
  turnComplete: boolean;
  waitingForInput: boolean;
  interactionInProgress: boolean;
}

export function normalizeGeminiMessage(
  message: LiveServerMessage,
  at: number,
): NormalizedGeminiMessage {
  const transcriptEvents: TranscriptEvent[] = [];
  const voiceActivity = message.voiceActivity?.voiceActivityType;

  if (voiceActivity === VoiceActivityType.ACTIVITY_START) {
    transcriptEvents.push({
      type: "input-activity-start",
      at,
    });
  }

  const serverContent = message.serverContent;
  const audioChunks: string[] = [];

  if (serverContent) {
    const interimInput = serverContent.interimInputTranscription?.text;
    const inputTranscription = serverContent.inputTranscription;
    const outputTranscription = serverContent.outputTranscription;

    if (interimInput !== undefined) {
      transcriptEvents.push({
        type: "input-interim",
        text: interimInput,
        at,
      });
    }

    if (inputTranscription?.text !== undefined || inputTranscription?.finished) {
      transcriptEvents.push({
        type: "input-transcription",
        text: inputTranscription.text ?? "",
        finished: Boolean(inputTranscription.finished),
        at,
      });
    }

    if (
      outputTranscription?.text !== undefined ||
      outputTranscription?.finished
    ) {
      transcriptEvents.push({
        type: "output-transcription",
        text: outputTranscription.text ?? "",
        finished: Boolean(outputTranscription.finished),
        at,
      });
    }

    if (serverContent.interrupted) {
      transcriptEvents.push({
        type: "interrupted",
        at,
      });
    }

    if (serverContent.turnComplete) {
      transcriptEvents.push({
        type: "turn-complete",
        at,
      });
    }

    for (const part of serverContent.modelTurn?.parts ?? []) {
      const inlineData = part.inlineData;
      if (
        inlineData?.data &&
        (!inlineData.mimeType || inlineData.mimeType.startsWith("audio/"))
      ) {
        audioChunks.push(inlineData.data);
      }
    }
  }

  if (voiceActivity === VoiceActivityType.ACTIVITY_END) {
    transcriptEvents.push({
      type: "input-activity-end",
      at,
    });
  }

  return {
    transcriptEvents,
    audioChunks,
    interrupted: Boolean(serverContent?.interrupted),
    turnComplete: Boolean(serverContent?.turnComplete),
    waitingForInput: Boolean(serverContent?.waitingForInput),
    interactionInProgress:
      serverContent?.interactionStatus === InteractionStatus.IN_PROGRESS,
  };
}
