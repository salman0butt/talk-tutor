import {
  InteractionStatus,
  type LiveServerMessage,
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
  const serverContent = message.serverContent;

  if (!serverContent) {
    return {
      transcriptEvents: [],
      audioChunks: [],
      interrupted: false,
      turnComplete: false,
      waitingForInput: false,
      interactionInProgress: false,
    };
  }

  const transcriptEvents: TranscriptEvent[] = [];
  const interimInput = serverContent.interimInputTranscription?.text;
  const finalInput = serverContent.inputTranscription?.text;
  const outputText = serverContent.outputTranscription?.text;

  if (interimInput !== undefined) {
    transcriptEvents.push({
      type: "input-interim",
      text: interimInput,
      at,
    });
  }

  if (finalInput !== undefined) {
    transcriptEvents.push({
      type: "input-final",
      text: finalInput,
      at,
    });
  }

  if (outputText !== undefined) {
    transcriptEvents.push({
      type: "output-fragment",
      text: outputText,
      at,
    });
  }

  if (serverContent.interrupted) {
    transcriptEvents.push({ type: "interrupted", at });
  }

  if (serverContent.turnComplete) {
    transcriptEvents.push({ type: "turn-complete", at });
  }

  const audioChunks: string[] = [];
  for (const part of serverContent.modelTurn?.parts ?? []) {
    const inlineData = part.inlineData;
    if (
      inlineData?.data &&
      (!inlineData.mimeType || inlineData.mimeType.startsWith("audio/"))
    ) {
      audioChunks.push(inlineData.data);
    }
  }

  return {
    transcriptEvents,
    audioChunks,
    interrupted: Boolean(serverContent.interrupted),
    turnComplete: Boolean(serverContent.turnComplete),
    waitingForInput: Boolean(serverContent.waitingForInput),
    interactionInProgress:
      serverContent.interactionStatus === InteractionStatus.IN_PROGRESS,
  };
}
