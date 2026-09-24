import assert from 'node:assert/strict';
import test from 'node:test';
import { requireIsolatedDatabaseUrl } from './database-test-guard';

const testDatabaseUrl = requireIsolatedDatabaseUrl(process.env);
process.env.DATABASE_URL = testDatabaseUrl;

function errorChainIncludes(error: unknown, pattern: RegExp): boolean {
  let current = error;
  while (current instanceof Error) {
    if (pattern.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

test('admin users integration: migrated schema, profile repository and last-admin guard', async (t) => {
  const [{ and, eq, inArray }, { db }, { appProfiles }, { teamProfileRepository }] = await Promise.all([
    import('drizzle-orm'),
    import('../../src/lib/db'),
    import('../../src/lib/db/schema'),
    import('../../src/lib/team-repository'),
  ]);

  const tag = `__team-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  try {
    await t.test('journal records 0000 through 0004 in order', async () => {
      const result = await db.execute<{ created_at: string }>(
        // This integration-only query verifies the baseline and ordered migration evidence.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import('drizzle-orm')).sql`select created_at from drizzle.__drizzle_migrations order by created_at`,
      );
      assert.deepEqual(result.rows.map((row) => Number(row.created_at)), [
        1789860707440,
        1789860711598,
        1789937654933,
        1790025253609,
        1790123399276,
      ]);
    });

    await t.test('profile repository persists role and suspension without credentials', async () => {
      await teamProfileRepository.upsert({
        userId: tag,
        role: 'editor',
        suspended: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const inserted = await teamProfileRepository.get(tag);
      assert.equal(inserted?.role, 'editor');
      assert.equal(inserted?.suspended, false);

      await teamProfileRepository.upsert({ ...inserted!, suspended: true, updatedAt: new Date().toISOString() });
      assert.equal((await teamProfileRepository.get(tag))?.suspended, true);
    });

    await t.test('database rejects roles outside admin and editor', async () => {
      await assert.rejects(
        db.insert(appProfiles).values({
          userId: `${tag}-invalid`, role: 'owner', suspended: false, createdAt: timestamp, updatedAt: timestamp,
        }),
        (error: unknown) => errorChainIncludes(error, /app_profiles_role_check/),
      );
    });

    await t.test('database refuses to suspend the only active administrator', async () => {
      const activeAdmins = await db.select().from(appProfiles).where(and(eq(appProfiles.role, 'admin'), eq(appProfiles.suspended, false)));
      assert.equal(activeAdmins.length, 1, 'isolated branch should start with exactly the promoted root admin');
      const rootId = activeAdmins[0]!.userId;
      await assert.rejects(
        db.update(appProfiles).set({ suspended: true, updatedAt: new Date().toISOString() }).where(eq(appProfiles.userId, rootId)),
        (error: unknown) => errorChainIncludes(error, /app_profiles_last_active_admin_check|at least one active administrator is required/),
      );
      const root = await teamProfileRepository.get(rootId);
      assert.equal(root?.suspended, false);
      assert.equal(root?.role, 'admin');
    });
  } finally {
    await db.delete(appProfiles).where(inArray(appProfiles.userId, [tag, `${tag}-invalid`]));
  }
});
