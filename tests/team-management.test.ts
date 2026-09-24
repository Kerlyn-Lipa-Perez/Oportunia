import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTeamUser,
  listTeamUsers,
  TeamManagementError,
  updateTeamUser,
  type AuthDirectoryUser,
  type TeamDependencies,
  type TeamProfile,
} from '../src/lib/team-management';

function harness(options: {
  users?: AuthDirectoryUser[];
  profiles?: TeamProfile[];
  failProfileWrite?: boolean;
} = {}) {
  const users = [...(options.users ?? [])];
  const profiles = [...(options.profiles ?? [])];
  const calls: string[] = [];
  const dependencies: TeamDependencies = {
    now: () => new Date('2026-09-23T00:00:00.000Z'),
    auth: {
      async listUsers() { return users; },
      async createUser(input) {
        calls.push(`create:${input.email}:${input.role}`);
        const user = { id: `user-${users.length + 1}`, email: input.email, name: input.name, role: input.role, banned: false };
        users.push(user);
        return user;
      },
      async setRole(userId, role) { calls.push(`role:${userId}:${role}`); },
      async banUser(userId) { calls.push(`ban:${userId}`); const user = users.find((item) => item.id === userId); if (user) user.banned = true; },
      async unbanUser(userId) { calls.push(`unban:${userId}`); const user = users.find((item) => item.id === userId); if (user) user.banned = false; },
      async revokeUserSessions(userId) { calls.push(`revoke:${userId}`); },
    },
    profiles: {
      async list() { return profiles; },
      async get(userId) { return profiles.find((profile) => profile.userId === userId) ?? null; },
      async upsert(profile) {
        calls.push(`profile:${profile.userId}:${profile.role}:${profile.suspended}`);
        if (options.failProfileWrite) throw new Error('database unavailable');
        const existing = profiles.findIndex((item) => item.userId === profile.userId);
        if (existing >= 0) profiles[existing] = profile;
        else profiles.push(profile);
        return profile;
      },
    },
  };
  return { calls, dependencies, profiles, users };
}

const actor = { id: 'root', email: 'root@example.com' };

test('listTeamUsers merges Neon identity state with application roles without granting unprofiled users access', async () => {
  const { dependencies } = harness({
    users: [
      { id: 'root', email: 'root@example.com', name: 'Root', role: 'admin', banned: false },
      { id: 'orphan', email: 'orphan@example.com', name: 'Orphan', role: 'user', banned: false },
    ],
    profiles: [{ userId: 'root', role: 'admin', suspended: false, createdAt: 'now', updatedAt: 'now' }],
  });

  const users = await listTeamUsers(actor, dependencies);
  assert.deepEqual(users.map(({ id, role, status, isCurrent }) => ({ id, role, status, isCurrent })), [
    { id: 'orphan', role: null, status: 'unconfigured', isCurrent: false },
    { id: 'root', role: 'admin', status: 'active', isCurrent: true },
  ]);
});

test('createTeamUser rejects initial passwords shorter than twelve characters before calling Neon Auth', async () => {
  const { calls, dependencies } = harness();
  await assert.rejects(
    createTeamUser({ name: 'Editora', email: 'editor@example.com', password: 'short', role: 'editor' }, actor, dependencies),
    (error: unknown) => error instanceof TeamManagementError && error.code === 'invalid_password',
  );
  assert.deepEqual(calls, []);
});

test('createTeamUser maps editor to Neon user and persists only the application role', async () => {
  const { calls, dependencies, profiles } = harness();
  const created = await createTeamUser({
    name: 'Editora', email: 'editor@example.com', password: 'a-long-initial-password', role: 'editor',
  }, actor, dependencies);

  assert.equal(created.role, 'editor');
  assert.equal(created.status, 'active');
  assert.deepEqual(calls, [
    'create:editor@example.com:user',
    'profile:user-1:editor:false',
  ]);
  assert.equal(profiles[0]?.role, 'editor');
  assert.equal('password' in profiles[0]!, false);
});

test('a failed profile write leaves a newly created identity banned and without active sessions', async () => {
  const { calls, dependencies } = harness({ failProfileWrite: true });
  await assert.rejects(
    createTeamUser({ name: 'Editora', email: 'editor@example.com', password: 'a-long-initial-password', role: 'editor' }, actor, dependencies),
    (error: unknown) => error instanceof TeamManagementError && error.code === 'profile_sync_failed',
  );
  assert.deepEqual(calls, [
    'create:editor@example.com:user',
    'profile:user-1:editor:false',
    'ban:user-1',
    'revoke:user-1',
  ]);
});

test('an administrator cannot change or suspend their own account', async () => {
  const { calls, dependencies } = harness({
    users: [{ id: 'root', email: 'root@example.com', name: 'Root', role: 'admin', banned: false }],
    profiles: [{ userId: 'root', role: 'admin', suspended: false, createdAt: 'now', updatedAt: 'now' }],
  });
  await assert.rejects(
    updateTeamUser({ userId: 'root', role: 'editor' }, actor, dependencies),
    (error: unknown) => error instanceof TeamManagementError && error.code === 'self_management_forbidden',
  );
  assert.deepEqual(calls, []);
});

test('the last active administrator cannot be demoted or suspended', async () => {
  const state = {
    users: [
      { id: 'root', email: 'root@example.com', name: 'Root', role: 'admin', banned: true },
      { id: 'admin-2', email: 'second@example.com', name: 'Second', role: 'admin', banned: false },
    ] satisfies AuthDirectoryUser[],
    profiles: [
      { userId: 'root', role: 'admin', suspended: true, createdAt: 'now', updatedAt: 'now' },
      { userId: 'admin-2', role: 'admin', suspended: false, createdAt: 'now', updatedAt: 'now' },
    ] satisfies TeamProfile[],
  };
  for (const update of [{ role: 'editor' as const }, { active: false }]) {
    const { dependencies } = harness(state);
    await assert.rejects(
      updateTeamUser({ userId: 'admin-2', ...update }, actor, dependencies),
      (error: unknown) => error instanceof TeamManagementError && error.code === 'last_active_admin',
    );
  }
});

test('demoting an administrator updates application access before Neon role and revokes sessions', async () => {
  const { calls, dependencies } = harness({
    users: [
      { id: 'root', email: 'root@example.com', name: 'Root', role: 'admin', banned: false },
      { id: 'admin-2', email: 'second@example.com', name: 'Second', role: 'admin', banned: false },
    ],
    profiles: [
      { userId: 'root', role: 'admin', suspended: false, createdAt: 'old', updatedAt: 'old' },
      { userId: 'admin-2', role: 'admin', suspended: false, createdAt: 'old', updatedAt: 'old' },
    ],
  });

  const updated = await updateTeamUser({ userId: 'admin-2', role: 'editor' }, actor, dependencies);
  assert.equal(updated.role, 'editor');
  assert.deepEqual(calls, [
    'profile:admin-2:editor:false',
    'revoke:admin-2',
    'role:admin-2:user',
  ]);
});

test('suspending and reactivating fail closed in the application layer', async () => {
  const { calls, dependencies } = harness({
    users: [
      { id: 'root', email: 'root@example.com', name: 'Root', role: 'admin', banned: false },
      { id: 'editor', email: 'editor@example.com', name: 'Editor', role: 'user', banned: false },
    ],
    profiles: [
      { userId: 'root', role: 'admin', suspended: false, createdAt: 'old', updatedAt: 'old' },
      { userId: 'editor', role: 'editor', suspended: false, createdAt: 'old', updatedAt: 'old' },
    ],
  });

  await updateTeamUser({ userId: 'editor', active: false }, actor, dependencies);
  await updateTeamUser({ userId: 'editor', active: true }, actor, dependencies);
  assert.deepEqual(calls, [
    'profile:editor:editor:true',
    'ban:editor',
    'revoke:editor',
    'unban:editor',
    'profile:editor:editor:false',
  ]);
});
