import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requireAuthenticatedUserId,
  withAuthenticatedOwner,
  ownedSessionFilter,
} from '../../lib/learning/ownership.ts';

test('unauthenticated learning mutations are rejected', () => {
  assert.throws(() => requireAuthenticatedUserId(null), /unauthorized/i);
  assert.throws(() => requireAuthenticatedUserId({ id: '' }), /unauthorized/i);
});

test('owner identity always comes from authenticated session, never client body', () => {
  const row = withAuthenticatedOwner('11111111-1111-4111-8111-111111111111', {
    user_id: '22222222-2222-4222-8222-222222222222',
    topic: 'Travel & Directions',
  });
  assert.equal(row.user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(row.topic, 'Travel & Directions');
});

test('owned session filter includes both validated session and authenticated owner', () => {
  assert.deepEqual(
    ownedSessionFilter(
      '11111111-1111-4111-8111-111111111111',
      '550e8400-e29b-41d4-a716-446655440000',
    ),
    {
      id: 'eq.550e8400-e29b-41d4-a716-446655440000',
      user_id: 'eq.11111111-1111-4111-8111-111111111111',
    },
  );
});

test('malformed session ids fail before a repository request can be built', () => {
  assert.throws(
    () => ownedSessionFilter('11111111-1111-4111-8111-111111111111', '../victim'),
    /session id/i,
  );
});
