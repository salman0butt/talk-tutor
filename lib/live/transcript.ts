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
  inputActivityStartedAt: number | null;
  releasedMessageIds: string[];
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
    inputActivityStartedAt: null,
    releasedMessageIds: [],
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
): TranscriptState {
  const id = `${state.sessionId}-${speaker}-${state.nextMessageNumber}`;
  const startedAt =
    speaker === "user" ? state.inputActivityStartedAt ?? at : at;
  const message: TranscriptMessage = {
    id,
    speaker,
    text,
    status: "streaming",
    startedAt,
  };
  const messages = [...state.messages];
  const insertionIndex = messages.findIndex(
    (candidate) => candidate.startedAt > startedAt,
  );

  if (insertionIndex === -1) {
    messages.push(message);
  } else {
    messages.splice(insertionIndex, 0, message);
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

function completeSpeaker(
  state: TranscriptState,
  speaker: TranscriptSpeaker,
  at: number,
): TranscriptState {
  const idField = messageIdField(speaker);
  const messageId = state[idField];

  if (!messageId) {
    return state;
  }

  const messages = [...state.messages];
  const index = messages.findIndex(
    (message) =>
      message.id === messageId && message.status === "streaming",
  );

  if (index === -1) {
    return {
      ...state,
      [idField]: null,
    };
  }

  const text = messages[index].text.trim();
  if (!text) {
    messages.splice(index, 1);
    return {
      ...state,
      messages,
      [idField]: null,
    };
  }

  messages[index] = {
    ...messages[index],
    text,
    status: "complete",
    completedAt: at,
  };

  if (speaker === "user") {
    return {
      ...state,
      messages,
      inputMessageId: null,
      inputCommittedText: "",
      inputInterimText: "",
      inputActivityStartedAt: null,
    };
  }

  return {
    ...state,
    messages,
    outputMessageId: null,
    outputText: "",
  };
}

function releaseReadyMessages(state: TranscriptState): TranscriptTransition {
  const released = new Set(state.releasedMessageIds);
  const completed: TranscriptMessage[] = [];
  const unresolvedInputReservation =
    state.inputActivityStartedAt !== null && !state.inputMessageId
      ? state.inputActivityStartedAt
      : null;

  for (const message of state.messages) {
    if (
      unresolvedInputReservation !== null &&
      unresolvedInputReservation <= message.startedAt
    ) {
      break;
    }

    if (message.status !== "complete") {
      break;
    }

    if (!released.has(message.id)) {
      released.add(message.id);
      completed.push(message);
    }
  }

  return {
    state: {
      ...state,
      releasedMessageIds: [...released],
    },
    completed,
  };
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
  let nextState = state;

  switch (event.type) {
    case "input-activity-start":
      nextState = {
        ...state,
        inputActivityActive: true,
        inputActivityStartedAt: state.inputActivityStartedAt ?? event.at,
      };
      break;

    case "input-activity-end":
      nextState = {
        ...state,
        inputActivityActive: false,
      };
      break;

    case "input-interim": {
      if (!hasMeaningfulText(event.text)) {
        return { state, completed: [] };
      }

      nextState = upsertStreamingMessage(
        {
          ...state,
          inputInterimText: event.text,
          inputActivityStartedAt: state.inputActivityStartedAt ?? event.at,
        },
        "user",
        event.text,
        event.at,
      );
      break;
    }

    case "input-transcription": {
      const inputCommittedText = state.inputCommittedText + event.text;

      if (
        !hasMeaningfulText(inputCommittedText) &&
        !state.inputMessageId
      ) {
        return { state, completed: [] };
      }

      nextState = upsertStreamingMessage(
        {
          ...state,
          inputCommittedText,
          inputInterimText: event.finished
            ? ""
            : state.inputInterimText,
          inputActivityStartedAt: state.inputActivityStartedAt ?? event.at,
        },
        "user",
        visibleInputText(state, inputCommittedText),
        event.at,
      );

      if (event.finished) {
        nextState = upsertStreamingMessage(
          {
            ...nextState,
            inputInterimText: "",
          },
          "user",
          inputCommittedText,
          event.at,
        );
        nextState = completeSpeaker(nextState, "user", event.at);
      }
      break;
    }

    case "output-transcription": {
      const outputText = state.outputText + event.text;

      if (!hasMeaningfulText(outputText) && !state.outputMessageId) {
        return { state, completed: [] };
      }

      nextState = upsertStreamingMessage(
        {
          ...state,
          outputText,
        },
        "assistant",
        outputText,
        event.at,
      );

      if (event.finished) {
        nextState = completeSpeaker(nextState, "assistant", event.at);
      }
      break;
    }

    case "turn-complete":
      nextState = state.inputActivityActive
        ? state
        : completeSpeaker(state, "user", event.at);
      nextState = completeSpeaker(nextState, "assistant", event.at);
      break;

    case "interrupted":
      nextState = completeSpeaker(state, "assistant", event.at);
      break;

    case "session-end":
      if (hasMeaningfulText(state.inputCommittedText)) {
        nextState = completeSpeaker(state, "user", event.at);
      } else {
        nextState = removeStreamingMessage(state, "user");
        nextState = {
          ...nextState,
          inputCommittedText: "",
          inputInterimText: "",
        };
      }

      nextState = completeSpeaker(nextState, "assistant", event.at);
      nextState = {
        ...nextState,
        inputActivityActive: false,
        inputActivityStartedAt: null,
      };
      break;
  }

  return releaseReadyMessages(nextState);
}
