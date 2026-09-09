export type TranscriptSpeaker = "user" | "assistant";
export type TranscriptMessageStatus = "streaming" | "complete";

export interface TranscriptMessage {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  status: TranscriptMessageStatus;
  startedAt: number;
  completedAt?: number;
}

export interface TranscriptState {
  sessionId: string;
  nextMessageNumber: number;
  messages: TranscriptMessage[];
  inputMessageId: string | null;
  outputMessageId: string | null;
  inputFinalText: string;
  inputInterimText: string;
  outputText: string;
}

export type TranscriptEvent =
  | { type: "input-interim"; text: string; at: number }
  | { type: "input-final"; text: string; at: number }
  | { type: "output-fragment"; text: string; at: number }
  | { type: "turn-complete"; at: number }
  | { type: "interrupted"; at: number };

export interface TranscriptTransition {
  state: TranscriptState;
  completed: TranscriptMessage[];
}

export function createTranscriptState(sessionId: string): TranscriptState {
  return {
    sessionId,
    nextMessageNumber: 1,
    messages: [],
    inputMessageId: null,
    outputMessageId: null,
    inputFinalText: "",
    inputInterimText: "",
    outputText: "",
  };
}

function hasMeaningfulText(text: string) {
  return text.trim().length > 0;
}

function messageIdField(speaker: TranscriptSpeaker) {
  return speaker === "user" ? "inputMessageId" : "outputMessageId";
}

function upsertStreamingMessage(
  state: TranscriptState,
  speaker: TranscriptSpeaker,
  text: string,
  at: number,
): TranscriptState {
  if (!hasMeaningfulText(text)) return state;

  const idField = messageIdField(speaker);
  const existingId = state[idField];
  const messages = [...state.messages];

  if (existingId) {
    const index = messages.findIndex(
      (message) => message.id === existingId && message.status === "streaming",
    );
    if (index !== -1) {
      messages[index] = { ...messages[index], text };
      return { ...state, messages };
    }
  }

  const id = `${state.sessionId}-${speaker}-${state.nextMessageNumber}`;
  messages.push({
    id,
    speaker,
    text,
    status: "streaming",
    startedAt: at,
  });

  return {
    ...state,
    messages,
    [idField]: id,
    nextMessageNumber: state.nextMessageNumber + 1,
  };
}

function finalizeSpeaker(
  state: TranscriptState,
  speaker: TranscriptSpeaker,
  at: number,
): TranscriptTransition {
  const idField = messageIdField(speaker);
  const messageId = state[idField];

  if (!messageId) {
    return { state, completed: [] };
  }

  const messages = [...state.messages];
  const index = messages.findIndex(
    (message) => message.id === messageId && message.status === "streaming",
  );

  if (index === -1) {
    return {
      state: {
        ...state,
        [idField]: null,
      },
      completed: [],
    };
  }

  const text = messages[index].text.trim();
  if (!text) {
    messages.splice(index, 1);
    return {
      state: {
        ...state,
        messages,
        [idField]: null,
      },
      completed: [],
    };
  }

  const completedMessage: TranscriptMessage = {
    ...messages[index],
    text,
    status: "complete",
    completedAt: at,
  };
  messages[index] = completedMessage;

  const nextState: TranscriptState =
    speaker === "user"
      ? {
          ...state,
          messages,
          inputMessageId: null,
          inputFinalText: "",
          inputInterimText: "",
        }
      : {
          ...state,
          messages,
          outputMessageId: null,
          outputText: "",
        };

  return { state: nextState, completed: [completedMessage] };
}

function finalizeInput(state: TranscriptState, at: number) {
  return finalizeSpeaker(state, "user", at);
}

function finalizeOutput(state: TranscriptState, at: number) {
  return finalizeSpeaker(state, "assistant", at);
}

export function applyTranscriptEvent(
  state: TranscriptState,
  event: TranscriptEvent,
): TranscriptTransition {
  switch (event.type) {
    case "input-interim": {
      if (!hasMeaningfulText(event.text)) {
        return { state, completed: [] };
      }

      const inputInterimText = event.text;
      const visibleText = state.inputFinalText + inputInterimText;
      const nextState = upsertStreamingMessage(
        { ...state, inputInterimText },
        "user",
        visibleText,
        event.at,
      );
      return { state: nextState, completed: [] };
    }

    case "input-final": {
      if (
        !hasMeaningfulText(event.text) &&
        !state.inputMessageId &&
        !hasMeaningfulText(state.inputFinalText)
      ) {
        return { state, completed: [] };
      }

      const inputFinalText = state.inputFinalText + event.text;
      const nextState = upsertStreamingMessage(
        {
          ...state,
          inputFinalText,
          inputInterimText: "",
        },
        "user",
        inputFinalText,
        event.at,
      );
      return { state: nextState, completed: [] };
    }

    case "output-fragment": {
      if (!hasMeaningfulText(event.text) && !state.outputMessageId) {
        return { state, completed: [] };
      }

      const userTransition = finalizeInput(state, event.at);
      const outputText = userTransition.state.outputText + event.text;
      const nextState = upsertStreamingMessage(
        { ...userTransition.state, outputText },
        "assistant",
        outputText,
        event.at,
      );

      return {
        state: nextState,
        completed: userTransition.completed,
      };
    }

    case "turn-complete": {
      const userTransition = finalizeInput(state, event.at);
      const outputTransition = finalizeOutput(userTransition.state, event.at);
      return {
        state: outputTransition.state,
        completed: [
          ...userTransition.completed,
          ...outputTransition.completed,
        ],
      };
    }

    case "interrupted":
      return finalizeOutput(state, event.at);
  }
}
