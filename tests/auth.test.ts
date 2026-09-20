import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizationStatus, resolveAdminAccess } from '../src/lib/authz';

test('resolveAdminAccess rejects a request without a Neon Auth session', async () => {
  const access = await resolveAdminAccess(null, async () => 'admin');

  assert.deepEqual(access, { kind: 'unauthenticated' });
});

test('resolveAdminAccess rejects an authenticated user without the admin role', async () => {
  const access = await resolveAdminAccess({ id: 'user-1', email: 'writer@example.com' }, async () => 'editor');

  assert.deepEqual(access, { kind: 'forbidden' });
});

test('resolveAdminAccess returns the Neon identity only for an admin application profile', async () => {
  const access = await resolveAdminAccess({ id: 'admin-1', email: 'admin@example.com' }, async (userId) => {
    assert.equal(userId, 'admin-1');
    return 'admin';
  });

  assert.deepEqual(access, { kind: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } });
});

test('authorizationStatus distinguishes missing sessions from authenticated non-admin users', () => {
  assert.equal(authorizationStatus({ kind: 'unauthenticated' }), 401);
  assert.equal(authorizationStatus({ kind: 'forbidden' }), 403);
});
