import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTranscriptEvent,
  createTranscriptState,
} from '../../lib/live/transcript.ts';

const event = (type, text, at) => text === undefined ? { type, at } : { type, text, at };

test('interim user transcription replaces the streaming snapshot instead of duplicating it', () => {
  let state = createTranscriptState('session-1');
  state = applyTranscriptEvent(state, event('input-interim', 'I', 1000)).state;
  state = applyTranscriptEvent(state, event('input-interim', 'I want', 1010)).state;
  state = applyTranscriptEvent(state, event('input-interim', 'I want coffee', 1020)).state;

  assert.deepEqual(
    state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [{ speaker: 'user', text: 'I want coffee', status: 'streaming' }],
  );
});

test('final input fragments replace interim text and accumulate exactly once', () => {
  let state = createTranscriptState('session-1');
  state = applyTranscriptEvent(state, event('input-interim', 'I want', 1000)).state;
  state = applyTranscriptEvent(state, event('input-final', 'I ', 1010)).state;
  state = applyTranscriptEvent(state, event('input-final', 'want coffee', 1020)).state;

  const transition = applyTranscriptEvent(
    state,
    event('output-fragment', 'Sure.', 1100),
  );

  assert.equal(transition.completed.length, 1);
  assert.equal(transition.completed[0].speaker, 'user');
  assert.equal(transition.completed[0].text, 'I want coffee');
  assert.deepEqual(
    transition.state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [
      { speaker: 'user', text: 'I want coffee', status: 'complete' },
      { speaker: 'assistant', text: 'Sure.', status: 'streaming' },
    ],
  );
});

test('assistant fragments stream in one row and turnComplete finalizes it once', () => {
  let state = createTranscriptState('session-1');
  state = applyTranscriptEvent(state, event('output-fragment', 'Hello', 1000)).state;
  state = applyTranscriptEvent(state, event('output-fragment', ' there', 1010)).state;

  const transition = applyTranscriptEvent(state, event('turn-complete', undefined, 1020));

  assert.equal(transition.completed.length, 1);
  assert.equal(transition.completed[0].text, 'Hello there');
  assert.equal(transition.state.messages[0].status, 'complete');

  const repeatedBoundary = applyTranscriptEvent(
    transition.state,
    event('turn-complete', undefined, 1030),
  );
  assert.equal(repeatedBoundary.completed.length, 0);
  assert.equal(repeatedBoundary.state.messages.length, 1);
});

test('user and assistant turns stay in chronological order across multiple turns', () => {
  let state = createTranscriptState('session-1');

  for (const e of [
    event('input-final', 'Hi', 1000),
    event('output-fragment', 'Hello!', 1010),
    event('turn-complete', undefined, 1020),
    event('input-final', 'How are you?', 1030),
    event('output-fragment', 'Great.', 1040),
    event('turn-complete', undefined, 1050),
  ]) {
    state = applyTranscriptEvent(state, e).state;
  }

  assert.deepEqual(
    state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [
      { speaker: 'user', text: 'Hi', status: 'complete' },
      { speaker: 'assistant', text: 'Hello!', status: 'complete' },
      { speaker: 'user', text: 'How are you?', status: 'complete' },
      { speaker: 'assistant', text: 'Great.', status: 'complete' },
    ],
  );
});

test('interruption finalizes the observed assistant text without duplicating it', () => {
  let state = createTranscriptState('session-1');
  state = applyTranscriptEvent(state, event('output-fragment', 'You could say', 1000)).state;

  const interrupted = applyTranscriptEvent(state, event('interrupted', undefined, 1010));
  assert.equal(interrupted.completed.length, 1);
  assert.equal(interrupted.completed[0].text, 'You could say');
  assert.equal(interrupted.state.messages[0].status, 'complete');

  const next = applyTranscriptEvent(
    interrupted.state,
    event('input-final', 'Actually, let me try.', 1020),
  );
  assert.equal(next.state.messages.length, 2);
  assert.equal(next.state.messages[1].speaker, 'user');
  assert.equal(next.state.messages[1].status, 'streaming');
});

test('whitespace-only signals do not create transcript rows', () => {
  let state = createTranscriptState('session-1');
  for (const e of [
    event('input-interim', '   ', 1000),
    event('input-final', '\n', 1010),
    event('output-fragment', '\t', 1020),
    event('turn-complete', undefined, 1030),
  ]) {
    state = applyTranscriptEvent(state, e).state;
  }

  assert.equal(state.messages.length, 0);
});

test('message identity is stable and does not depend on wall-clock uniqueness', () => {
  let state = createTranscriptState('session-7');
  state = applyTranscriptEvent(state, event('input-final', 'First', 1000)).state;
  state = applyTranscriptEvent(state, event('output-fragment', 'Second', 1000)).state;
  state = applyTranscriptEvent(state, event('turn-complete', undefined, 1000)).state;

  assert.equal(state.messages[0].id, 'session-7-user-1');
  assert.equal(state.messages[1].id, 'session-7-assistant-2');
  assert.notEqual(state.messages[0].id, state.messages[1].id);
});

test('a new transcript session does not inherit streaming buffers from the previous session', () => {
  let oldState = createTranscriptState('session-1');
  oldState = applyTranscriptEvent(oldState, event('input-interim', 'unfinished', 1000)).state;

  const newState = createTranscriptState('session-2');

  assert.equal(oldState.messages.length, 1);
  assert.equal(newState.messages.length, 0);
  assert.equal(newState.inputFinalText, '');
  assert.equal(newState.inputInterimText, '');
  assert.equal(newState.outputText, '');
});

test('cumulative final input snapshots do not duplicate prior text', () => {
  let state = createTranscriptState('session-cumulative-input');
  state = applyTranscriptEvent(state, event('input-final', 'I', 1000)).state;
  state = applyTranscriptEvent(state, event('input-final', 'I want', 1010)).state;
  state = applyTranscriptEvent(state, event('input-final', 'I want coffee', 1020)).state;

  const transition = applyTranscriptEvent(
    state,
    event('output-fragment', 'Okay.', 1030),
  );

  assert.equal(transition.completed[0].text, 'I want coffee');
});

test('cumulative and duplicate assistant transcript events merge without repetition', () => {
  let state = createTranscriptState('session-cumulative-output');
  state = applyTranscriptEvent(state, event('output-fragment', 'Hello', 1000)).state;
  state = applyTranscriptEvent(state, event('output-fragment', 'Hello there', 1010)).state;
  state = applyTranscriptEvent(state, event('output-fragment', 'Hello there', 1020)).state;

  const transition = applyTranscriptEvent(
    state,
    event('turn-complete', undefined, 1030),
  );

  assert.equal(transition.completed.length, 1);
  assert.equal(transition.completed[0].text, 'Hello there');
});


test('finished input transcription commits the user turn without waiting for assistant output', () => {
  let state = createTranscriptState('finished-input');
  state = applyTranscriptEvent(
    state,
    { type: 'input-transcription', text: 'Hello there', finished: true, at: 1000 },
  ).state;

  assert.deepEqual(
    state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [{ speaker: 'user', text: 'Hello there', status: 'complete' }],
  );
});

test('assistant output does not prematurely finalize a user turn whose final transcription is still pending', () => {
  let state = createTranscriptState('late-input-final');
  state = applyTranscriptEvent(
    state,
    { type: 'input-interim', text: 'I want coffee', at: 1000 },
  ).state;

  const assistantStarted = applyTranscriptEvent(
    state,
    { type: 'output-transcription', text: 'Sure.', finished: false, at: 1010 },
  );

  assert.equal(assistantStarted.completed.length, 0);
  assert.deepEqual(
    assistantStarted.state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [
      { speaker: 'user', text: 'I want coffee', status: 'streaming' },
      { speaker: 'assistant', text: 'Sure.', status: 'streaming' },
    ],
  );

  const finalInput = applyTranscriptEvent(
    assistantStarted.state,
    { type: 'input-transcription', text: 'I want coffee', finished: true, at: 1020 },
  );

  assert.equal(finalInput.completed.length, 1);
  assert.equal(finalInput.completed[0].speaker, 'user');
  assert.deepEqual(
    finalInput.state.messages.map(({ speaker, text, status }) => ({ speaker, text, status })),
    [
      { speaker: 'user', text: 'I want coffee', status: 'complete' },
      { speaker: 'assistant', text: 'Sure.', status: 'streaming' },
    ],
  );
});

test('repeated identical transcript deltas preserve legitimate repeated speech', () => {
  let state = createTranscriptState('repeated-words');
  state = applyTranscriptEvent(
    state,
    { type: 'output-transcription', text: 'very ', finished: false, at: 1000 },
  ).state;
  state = applyTranscriptEvent(
    state,
    { type: 'output-transcription', text: 'very ', finished: false, at: 1010 },
  ).state;
  state = applyTranscriptEvent(
    state,
    { type: 'output-transcription', text: 'good', finished: true, at: 1020 },
  ).state;

  assert.equal(state.messages[0].text, 'very very good');
  assert.equal(state.messages[0].status, 'complete');
});

test('turnComplete from an interrupted model does not finalize a newly active user utterance', () => {
  let state = createTranscriptState('barge-in-order');
  state = applyTranscriptEvent(
    state,
    { type: 'input-activity-start', at: 1000 },
  ).state;
  state = applyTranscriptEvent(
    state,
    { type: 'input-interim', text: 'Actually let me try', at: 1010 },
  ).state;

  const boundary = applyTranscriptEvent(
    state,
    { type: 'turn-complete', at: 1020 },
  );

  assert.equal(boundary.completed.length, 0);
  assert.equal(boundary.state.messages[0].status, 'streaming');
});
