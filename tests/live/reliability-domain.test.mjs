import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLiveCompatibility } from '../../lib/live/compatibility.ts';
import {
  classifyLiveFailure,
  isRetryableTutorError,
  tutorErrorMessage,
} from '../../lib/live/errors.ts';
import { computeSessionPolicy } from '../../lib/live/session-policy.ts';

const supported = {
  secureContext: true,
  mediaDevices: true,
  getUserMedia: true,
  audioContext: true,
  audioWorklet: true,
};

test('compatibility preflight feature-detects required browser capabilities', () => {
  assert.deepEqual(checkLiveCompatibility(supported), { supported: true, issues: [] });
  assert.deepEqual(checkLiveCompatibility({ ...supported, mediaDevices: false, getUserMedia: false }), {
    supported: false,
    issues: ['media_devices', 'get_user_media'],
  });
  assert.equal(checkLiveCompatibility({ ...supported, secureContext: false }).supported, false);
  assert.equal(checkLiveCompatibility({ ...supported, audioWorklet: false }).supported, false);
});

test('start failures classify permission, missing device, busy device, audio and network/provider errors', () => {
  assert.equal(classifyLiveFailure(new DOMException('denied', 'NotAllowedError'), 'microphone'), 'microphone_permission_denied');
  assert.equal(classifyLiveFailure(new DOMException('missing', 'NotFoundError'), 'microphone'), 'microphone_not_found');
  assert.equal(classifyLiveFailure(new DOMException('busy', 'NotReadableError'), 'microphone'), 'microphone_unavailable');
  assert.equal(classifyLiveFailure(new Error('context'), 'audio-context'), 'audio_context_failed');
  assert.equal(classifyLiveFailure(new Error('worklet'), 'audio-worklet'), 'audio_worklet_failed');
  assert.equal(classifyLiveFailure(new TypeError('fetch failed'), 'token'), 'network');
  assert.equal(classifyLiveFailure(new Error('provider'), 'provider'), 'provider');
});

test('retry policy retries only transient categories', () => {
  for (const code of ['network', 'token', 'provider', 'session_closed']) {
    assert.equal(isRetryableTutorError(code), true, code);
  }
  for (const code of ['microphone_permission_denied', 'unsupported_browser', 'usage_limit', 'session_timeout']) {
    assert.equal(isRetryableTutorError(code), false, code);
  }
  assert.match(tutorErrorMessage('usage_limit'), /upgrade|allowance|minutes/i);
  assert.match(tutorErrorMessage('microphone_permission_denied'), /permission/i);
});

test('session policy uses provider connection boundary unless remaining usage is smaller', () => {
  assert.deepEqual(computeSessionPolicy({ remainingUsageSeconds: 30 * 60 }), {
    maxSessionSeconds: 600,
    warningAtSeconds: 480,
    reason: 'provider_limit',
  });
  assert.deepEqual(computeSessionPolicy({ remainingUsageSeconds: 300 }), {
    maxSessionSeconds: 300,
    warningAtSeconds: 180,
    reason: 'usage_limit',
  });
  assert.deepEqual(computeSessionPolicy({ remainingUsageSeconds: 90 }), {
    maxSessionSeconds: 90,
    warningAtSeconds: 0,
    reason: 'usage_limit',
  });
  assert.deepEqual(computeSessionPolicy({ remainingUsageSeconds: 0 }), {
    maxSessionSeconds: 0,
    warningAtSeconds: 0,
    reason: 'usage_limit',
  });
});
