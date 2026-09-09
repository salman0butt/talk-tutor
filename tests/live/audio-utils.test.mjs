import test from 'node:test';
import assert from 'node:assert/strict';
import { createPCMBlob } from '../../lib/audioUtils.ts';

function decodePcm16(base64) {
  const bytes = Buffer.from(base64, 'base64');
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

test('createPCMBlob encodes zero and preserves declared sample rate', () => {
  const blob = createPCMBlob(new Float32Array([0]), 48000);
  assert.equal(blob.mimeType, 'audio/pcm;rate=48000');
  assert.equal(decodePcm16(blob.data)[0], 0);
});

test('createPCMBlob maps full-scale positive and negative samples to Int16 bounds', () => {
  const blob = createPCMBlob(new Float32Array([1, -1]), 16000);
  const pcm = decodePcm16(blob.data);
  assert.deepEqual(Array.from(pcm), [32767, -32768]);
});

test('createPCMBlob clamps samples outside the Float32 audio range', () => {
  const blob = createPCMBlob(new Float32Array([2, -2]), 16000);
  const pcm = decodePcm16(blob.data);
  assert.deepEqual(Array.from(pcm), [32767, -32768]);
});

test('createPCMBlob emits exactly two bytes per mono sample', () => {
  const blob = createPCMBlob(new Float32Array([0.25, -0.25, 0.5]), 44100);
  const bytes = Buffer.from(blob.data, 'base64');
  assert.equal(bytes.byteLength, 6);
  assert.equal(blob.mimeType, 'audio/pcm;rate=44100');
});

test('createPCMBlob rejects invalid sample rates', () => {
  assert.throws(
    () => createPCMBlob(new Float32Array([0]), 0),
    /sample rate/i,
  );
});
