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
  inputCommittedText: string;
  inputInterimText: string;
  outputText: string;
  inputActivityActive: boolean;
}

export type TranscriptEvent =
  | { type: "input-activity-start"; at: number }
  | { type: "input-activity-end"; at: number }
  | { type: "input-interim"; text: string; at: number }
  | {
      type: "input-transcription";
      text: string;
      finished: boolean;
      at: number;
    }
  | {
      type: "output-transcription";
      text: string;
      finished: boolean;
      at: number;
    }
  | { type: "turn-complete"; at: number }
  | { type: "interrupted"; at: number }
  | { type: "session-end"; at: number };

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
    inputCommittedText: "",
    inputInterimText: "",
    outputText: "",
    inputActivityActive: false,
  };
}

function hasMeaningfulText(text: string) {
  return text.trim().length > 0;
}

function messageIdField(speaker: TranscriptSpeaker) {
  return speaker === "user" ? "inputMessageId" : "outputMessageId";
}

function insertStreamingMessage(
  state: TranscriptState,
  speaker: TranscriptSpeaker,
  text: string,
  at: number,
) {
  const id = `${state.sessionId}-${speaker}-${state.nextMessageNumber}`;
  const message: TranscriptMessage = {
    id,
    speaker,
    text,
    status: "streaming",
    startedAt: at,
  };
  const messages = [...state.messages];

  if (speaker === "user" && state.outputMessageId) {
    const assistantIndex = messages.findIndex(
      (candidate) => candidate.id === state.outputMessageId,
    );
    if (assistantIndex !== -1) {
      messages.splice(assistantIndex, 0, message);
    } else {
      messages.push(message);
    }
  } else {
    messages.push(message);
  }

  return {
    ...state,
    messages,
    [messageIdField(speaker)]: id,
    nextMessageNumber: state.nextMessageNumber + 1,
  };
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

  if (!existingId) {
    return insertStreamingMessage(state, speaker, text, at);
  }

  const messages = [...state.messages];
  const index = messages.findIndex(
    (message) =>
      message.id === existingId && message.status === "streaming",
  );

  if (index === -1) {
    return insertStreamingMessage(
      {
        ...state,
        [idField]: null,
      },
      speaker,
      text,
      at,
    );
  }

  messages[index] = {
    ...messages[index],
    text,
  };
  return {
    ...state,
    messages,
  };
}

function removeStreamingMessage(
  state: TranscriptState,
  speaker: TranscriptSpeaker,
): TranscriptState {
  const idField = messageIdField(speaker);
  const messageId = state[idField];
  if (!messageId) return state;

  return {
    ...state,
    messages: state.messages.filter(
      (message) =>
        !(message.id === messageId && message.status === "streaming"),
    ),
    [idField]: null,
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
    (message) =>
      message.id === messageId && message.status === "streaming",
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
          inputCommittedText: "",
          inputInterimText: "",
        }
      : {
          ...state,
          messages,
          outputMessageId: null,
          outputText: "",
        };

  return {
    state: nextState,
    completed: [completedMessage],
  };
}

function finalizeInput(state: TranscriptState, at: number) {
  return finalizeSpeaker(state, "user", at);
}

function finalizeOutput(state: TranscriptState, at: number) {
  return finalizeSpeaker(state, "assistant", at);
}

function visibleInputText(state: TranscriptState, committedText: string) {
  if (
    state.inputInterimText &&
    state.inputInterimText.startsWith(committedText)
  ) {
    return state.inputInterimText;
  }
  return committedText;
}

export function applyTranscriptEvent(
  state: TranscriptState,
  event: TranscriptEvent,
): TranscriptTransition {
  switch (event.type) {
    case "input-activity-start":
      return {
        state: {
          ...state,
          inputActivityActive: true,
        },
        completed: [],
      };

    case "input-activity-end":
      return {
        state: {
          ...state,
          inputActivityActive: false,
        },
        completed: [],
      };

    case "input-interim": {
      if (!hasMeaningfulText(event.text)) {
        return { state, completed: [] };
      }

      return {
        state: upsertStreamingMessage(
          {
            ...state,
            inputInterimText: event.text,
          },
          "user",
          event.text,
          event.at,
        ),
        completed: [],
      };
    }

    case "input-transcription": {
      const inputCommittedText =
        state.inputCommittedText + event.text;

      if (
        !hasMeaningfulText(inputCommittedText) &&
        !state.inputMessageId
      ) {
        return { state, completed: [] };
      }

      const nextState = upsertStreamingMessage(
        {
          ...state,
          inputCommittedText,
          inputInterimText: event.finished
            ? ""
            : state.inputInterimText,
        },
        "user",
        visibleInputText(state, inputCommittedText),
        event.at,
      );

      if (!event.finished) {
        return {
          state: nextState,
          completed: [],
        };
      }

      const committedVisibleState = upsertStreamingMessage(
        {
          ...nextState,
          inputInterimText: "",
        },
        "user",
        inputCommittedText,
        event.at,
      );
      return finalizeInput(committedVisibleState, event.at);
    }

    case "output-transcription": {
      const outputText = state.outputText + event.text;

      if (!hasMeaningfulText(outputText) && !state.outputMessageId) {
        return { state, completed: [] };
      }

      const nextState = upsertStreamingMessage(
        {
          ...state,
          outputText,
        },
        "assistant",
        outputText,
        event.at,
      );

      return event.finished
        ? finalizeOutput(nextState, event.at)
        : { state: nextState, completed: [] };
    }

    case "turn-complete": {
      const inputTransition = state.inputActivityActive
        ? { state, completed: [] as TranscriptMessage[] }
        : finalizeInput(state, event.at);
      const outputTransition = finalizeOutput(
        inputTransition.state,
        event.at,
      );
      return {
        state: outputTransition.state,
        completed: [
          ...inputTransition.completed,
          ...outputTransition.completed,
        ],
      };
    }

    case "interrupted":
      return finalizeOutput(state, event.at);

    case "session-end": {
      let inputState = state;
      let completed: TranscriptMessage[] = [];

      if (hasMeaningfulText(state.inputCommittedText)) {
        const inputTransition = finalizeInput(inputState, event.at);
        inputState = inputTransition.state;
        completed = inputTransition.completed;
      } else {
        inputState = removeStreamingMessage(inputState, "user");
        inputState = {
          ...inputState,
          inputCommittedText: "",
          inputInterimText: "",
          inputActivityActive: false,
        };
      }

      const outputTransition = finalizeOutput(inputState, event.at);
      return {
        state: {
          ...outputTransition.state,
          inputActivityActive: false,
        },
        completed: [...completed, ...outputTransition.completed],
      };
    }
  }
}
