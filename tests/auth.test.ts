import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizationStatus, resolveAdminAccess, resolveEditorialAccess } from '../src/lib/authz';

const active = (role: 'admin' | 'editor') => ({ role, suspended: false });

test('resolveAdminAccess rejects a request without a Neon Auth session', async () => {
  const access = await resolveAdminAccess(null, async () => active('admin'));

  assert.deepEqual(access, { kind: 'unauthenticated' });
});

test('resolveAdminAccess rejects an authenticated user without the admin role', async () => {
  const access = await resolveAdminAccess({ id: 'user-1', email: 'writer@example.com' }, async () => active('editor'));

  assert.deepEqual(access, { kind: 'forbidden' });
});

test('resolveAdminAccess returns the Neon identity only for an admin application profile', async () => {
  const access = await resolveAdminAccess({ id: 'admin-1', email: 'admin@example.com' }, async (userId) => {
    assert.equal(userId, 'admin-1');
    return active('admin');
  });

  assert.deepEqual(access, { kind: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } });
});

test('resolveEditorialAccess grants editors editorial access without promoting them to admin', async () => {
  const user = { id: 'editor-1', email: 'editor@example.com' };
  const editorial = await resolveEditorialAccess(user, async () => active('editor'));
  const administrative = await resolveAdminAccess(user, async () => active('editor'));

  assert.deepEqual(editorial, { kind: 'editor', user });
  assert.deepEqual(administrative, { kind: 'forbidden' });
});

test('suspended profiles are denied even when their stored role is admin', async () => {
  const user = { id: 'admin-1', email: 'admin@example.com' };
  const profile = async () => ({ role: 'admin', suspended: true });

  assert.deepEqual(await resolveEditorialAccess(user, profile), { kind: 'forbidden' });
  assert.deepEqual(await resolveAdminAccess(user, profile), { kind: 'forbidden' });
});

test('authorizationStatus distinguishes missing sessions from authenticated non-admin users', () => {
  assert.equal(authorizationStatus({ kind: 'unauthenticated' }), 401);
  assert.equal(authorizationStatus({ kind: 'forbidden' }), 403);
});
