import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTranscriptEvent,
  createTranscriptState,
} from '../../lib/live/transcript.ts';

test('interim user transcription replaces the streaming snapshot instead of appending it', () => {
  let state = createTranscriptState('session-1');
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'I',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'I want',
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'I want coffee',
    at: 1020,
  }).state;

  assert.deepEqual(
    state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [{ speaker: 'user', text: 'I want coffee', status: 'streaming' }],
  );
});

test('input transcription deltas append and finished commits the user turn', () => {
  let state = createTranscriptState('input-deltas');
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'I want coffee',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'I ',
    finished: false,
    at: 1010,
  }).state;

  const transition = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'want coffee',
    finished: true,
    at: 1020,
  });

  assert.equal(transition.completed.length, 1);
  assert.equal(transition.completed[0].speaker, 'user');
  assert.equal(transition.completed[0].text, 'I want coffee');
  assert.deepEqual(
    transition.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [{ speaker: 'user', text: 'I want coffee', status: 'complete' }],
  );
});

test('assistant transcription deltas stream in one row and finished commits once', () => {
  let state = createTranscriptState('output-deltas');
  state = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'Hi',
    finished: true,
    at: 990,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Hello',
    finished: false,
    at: 1000,
  }).state;

  const transition = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: ' there',
    finished: true,
    at: 1010,
  });

  assert.equal(transition.completed.length, 1);
  assert.equal(transition.completed[0].text, 'Hello there');
  const assistant = transition.state.messages.find(
    (message) => message.speaker === 'assistant',
  );
  assert.equal(assistant.status, 'complete');

  const repeatedBoundary = applyTranscriptEvent(
    transition.state,
    { type: 'turn-complete', at: 1020 },
  );
  assert.equal(repeatedBoundary.completed.length, 0);
  assert.equal(repeatedBoundary.state.messages.length, 2);
});

test('assistant output does not prematurely finalize a user turn whose final transcription is pending', () => {
  let state = createTranscriptState('late-input-final');
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'I want coffee',
    at: 1000,
  }).state;

  const assistantStarted = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Sure.',
    finished: false,
    at: 1010,
  });

  assert.equal(assistantStarted.completed.length, 0);
  assert.deepEqual(
    assistantStarted.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'I want coffee', status: 'streaming' },
      { speaker: 'assistant', text: 'Sure.', status: 'streaming' },
    ],
  );

  const finalInput = applyTranscriptEvent(assistantStarted.state, {
    type: 'input-transcription',
    text: 'I want coffee',
    finished: true,
    at: 1020,
  });

  assert.equal(finalInput.completed.length, 1);
  assert.equal(finalInput.completed[0].speaker, 'user');
  assert.deepEqual(
    finalInput.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'I want coffee', status: 'complete' },
      { speaker: 'assistant', text: 'Sure.', status: 'streaming' },
    ],
  );
});

test('late finalized input is inserted before a still-streaming assistant when interim input was unavailable', () => {
  let state = createTranscriptState('late-without-interim');
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Let us practice.',
    finished: false,
    at: 1000,
  }).state;

  const finalInput = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'Hello tutor',
    finished: true,
    at: 1010,
  });

  assert.deepEqual(
    finalInput.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'Hello tutor', status: 'complete' },
      { speaker: 'assistant', text: 'Let us practice.', status: 'streaming' },
    ],
  );
});

test('user and assistant turns remain chronological across multiple turns', () => {
  let state = createTranscriptState('session-order');

  for (const event of [
    {
      type: 'input-transcription',
      text: 'Hi',
      finished: true,
      at: 1000,
    },
    {
      type: 'output-transcription',
      text: 'Hello!',
      finished: true,
      at: 1010,
    },
    { type: 'turn-complete', at: 1020 },
    {
      type: 'input-transcription',
      text: 'How are you?',
      finished: true,
      at: 1030,
    },
    {
      type: 'output-transcription',
      text: 'Great.',
      finished: true,
      at: 1040,
    },
    { type: 'turn-complete', at: 1050 },
  ]) {
    state = applyTranscriptEvent(state, event).state;
  }

  assert.deepEqual(
    state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'Hi', status: 'complete' },
      { speaker: 'assistant', text: 'Hello!', status: 'complete' },
      { speaker: 'user', text: 'How are you?', status: 'complete' },
      { speaker: 'assistant', text: 'Great.', status: 'complete' },
    ],
  );
});

test('interruption finalizes observed assistant text without duplicating it', () => {
  let state = createTranscriptState('session-interrupted');
  state = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'How should I say it?',
    finished: true,
    at: 990,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'You could say',
    finished: false,
    at: 1000,
  }).state;

  const interrupted = applyTranscriptEvent(state, {
    type: 'interrupted',
    at: 1010,
  });

  assert.equal(interrupted.completed.length, 1);
  assert.equal(interrupted.completed[0].text, 'You could say');
  assert.equal(interrupted.state.messages[0].status, 'complete');
});

test('turnComplete from an interrupted model does not finalize a newly active user utterance', () => {
  let state = createTranscriptState('barge-in-order');
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Old assistant reply',
    finished: false,
    at: 990,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'Actually let me try',
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'interrupted',
    at: 1015,
  }).state;

  const boundary = applyTranscriptEvent(state, {
    type: 'turn-complete',
    at: 1020,
  });

  assert.equal(boundary.completed.length, 0);
  assert.equal(
    boundary.state.messages.find((message) => message.speaker === 'user').status,
    'streaming',
  );
});

test('turnComplete remains a fallback for input transcription when the SDK omits finished and user is no longer active', () => {
  let state = createTranscriptState('fallback-finalization');
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'Fallback text',
    finished: false,
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-end',
    at: 1020,
  }).state;

  const boundary = applyTranscriptEvent(state, {
    type: 'turn-complete',
    at: 1100,
  });

  assert.equal(boundary.completed.length, 1);
  assert.equal(boundary.completed[0].speaker, 'user');
  assert.equal(boundary.completed[0].text, 'Fallback text');
});

test('repeated identical transcript deltas preserve legitimate repeated speech', () => {
  let state = createTranscriptState('repeated-words');
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'very ',
    finished: false,
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'very ',
    finished: false,
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'good',
    finished: true,
    at: 1020,
  }).state;

  assert.equal(state.messages[0].text, 'very very good');
  assert.equal(state.messages[0].status, 'complete');
});

test('duplicate interim snapshots replace in place without creating duplicate rows', () => {
  let state = createTranscriptState('duplicate-interim');
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'hello',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'hello',
    at: 1010,
  }).state;

  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].text, 'hello');
});

test('whitespace-only signals do not create transcript rows', () => {
  let state = createTranscriptState('whitespace');

  for (const event of [
    { type: 'input-interim', text: '   ', at: 1000 },
    {
      type: 'input-transcription',
      text: '\n',
      finished: false,
      at: 1010,
    },
    {
      type: 'output-transcription',
      text: '\t',
      finished: false,
      at: 1020,
    },
    { type: 'turn-complete', at: 1030 },
  ]) {
    state = applyTranscriptEvent(state, event).state;
  }

  assert.equal(state.messages.length, 0);
});

test('message identity is stable and independent of wall-clock uniqueness', () => {
  let state = createTranscriptState('session-7');
  state = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'First',
    finished: true,
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Second',
    finished: true,
    at: 1000,
  }).state;

  assert.equal(state.messages[0].id, 'session-7-user-1');
  assert.equal(state.messages[1].id, 'session-7-assistant-2');
  assert.notEqual(state.messages[0].id, state.messages[1].id);
});

test('a new transcript session does not inherit streaming buffers from the previous session', () => {
  let oldState = createTranscriptState('session-1');
  oldState = applyTranscriptEvent(oldState, {
    type: 'input-interim',
    text: 'unfinished',
    at: 1000,
  }).state;

  const newState = createTranscriptState('session-2');

  assert.equal(oldState.messages.length, 1);
  assert.equal(newState.messages.length, 0);
  assert.equal(newState.inputCommittedText, '');
  assert.equal(newState.inputInterimText, '');
  assert.equal(newState.outputText, '');
  assert.equal(newState.inputActivityActive, false);
});


test('session end discards speculative interim input but commits observed assistant transcription', () => {
  let state = createTranscriptState('session-end-policy');
  state = applyTranscriptEvent(state, {
    type: 'input-interim',
    text: 'speculative words',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Observed tutor words',
    finished: false,
    at: 1010,
  }).state;

  const ended = applyTranscriptEvent(state, {
    type: 'session-end',
    at: 1020,
  });

  assert.deepEqual(
    ended.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      {
        speaker: 'assistant',
        text: 'Observed tutor words',
        status: 'complete',
      },
    ],
  );
  assert.equal(ended.completed.length, 1);
  assert.equal(ended.completed[0].speaker, 'assistant');
});


test('late finalized input keeps its activity-time order even after assistant already completed', () => {
  let state = createTranscriptState('late-after-assistant-complete');
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-end',
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Assistant answer',
    finished: true,
    at: 1020,
  }).state;

  const finalInput = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'User question',
    finished: true,
    at: 1030,
  });

  assert.deepEqual(
    finalInput.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'User question', status: 'complete' },
      { speaker: 'assistant', text: 'Assistant answer', status: 'complete' },
    ],
  );
});

test('barge-in user activity remains after the interrupted assistant in transcript order', () => {
  let state = createTranscriptState('barge-in-position');
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Assistant was speaking',
    finished: false,
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'interrupted',
    at: 1020,
  }).state;

  const user = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'Let me interrupt',
    finished: true,
    at: 1030,
  });

  assert.deepEqual(
    user.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      {
        speaker: 'assistant',
        text: 'Assistant was speaking',
        status: 'complete',
      },
      { speaker: 'user', text: 'Let me interrupt', status: 'complete' },
    ],
  );
});


test('completed messages are released for persistence only in chronological order', () => {
  let state = createTranscriptState('persistence-order');
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-end',
    at: 1010,
  }).state;

  const assistantFinished = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Assistant answer',
    finished: true,
    at: 1020,
  });

  assert.equal(assistantFinished.completed.length, 0);

  const userFinished = applyTranscriptEvent(assistantFinished.state, {
    type: 'input-transcription',
    text: 'User question',
    finished: true,
    at: 1030,
  });

  assert.deepEqual(
    userFinished.completed.map(({ speaker, text }) => ({ speaker, text })),
    [
      { speaker: 'user', text: 'User question' },
      { speaker: 'assistant', text: 'Assistant answer' },
    ],
  );
});


test('next user activity seals a late transcript that arrived after the previous turnComplete', () => {
  let state = createTranscriptState('late-after-turn-complete');
  state = applyTranscriptEvent(state, {
    type: 'input-activity-start',
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'input-activity-end',
    at: 1010,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Assistant answer',
    finished: false,
    at: 1020,
  }).state;

  const turnComplete = applyTranscriptEvent(state, {
    type: 'turn-complete',
    at: 1030,
  });
  assert.equal(turnComplete.completed.length, 0);

  const lateInput = applyTranscriptEvent(turnComplete.state, {
    type: 'input-transcription',
    text: 'User question',
    finished: false,
    at: 1040,
  });
  assert.equal(lateInput.completed.length, 0);

  const nextActivity = applyTranscriptEvent(lateInput.state, {
    type: 'input-activity-start',
    at: 2000,
  });

  assert.deepEqual(
    nextActivity.completed.map(({ speaker, text }) => ({ speaker, text })),
    [
      { speaker: 'user', text: 'User question' },
      { speaker: 'assistant', text: 'Assistant answer' },
    ],
  );
  assert.equal(nextActivity.state.inputActivityActive, true);
  assert.equal(nextActivity.state.inputActivityStartedAt, 2000);
});


test('late user transcription can precede a completed assistant even without voice-activity events', () => {
  let state = createTranscriptState('late-no-activity');
  state = applyTranscriptEvent(state, {
    type: 'output-transcription',
    text: 'Assistant answer',
    finished: true,
    at: 1000,
  }).state;
  state = applyTranscriptEvent(state, {
    type: 'turn-complete',
    at: 1010,
  }).state;

  const lateUser = applyTranscriptEvent(state, {
    type: 'input-transcription',
    text: 'User question',
    finished: true,
    at: 1020,
  });

  assert.deepEqual(
    lateUser.state.messages.map(({ speaker, text, status }) => ({
      speaker,
      text,
      status,
    })),
    [
      { speaker: 'user', text: 'User question', status: 'complete' },
      { speaker: 'assistant', text: 'Assistant answer', status: 'complete' },
    ],
  );
  assert.deepEqual(
    lateUser.completed.map(({ speaker, text }) => ({ speaker, text })),
    [
      { speaker: 'user', text: 'User question' },
      { speaker: 'assistant', text: 'Assistant answer' },
    ],
  );
});
