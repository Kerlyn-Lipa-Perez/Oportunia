import test from 'node:test';
import assert from 'node:assert/strict';
import type { Opportunity } from '../../src/lib/types';
import { requireIsolatedDatabaseUrl } from './database-test-guard';

const testDatabaseUrl = requireIsolatedDatabaseUrl(process.env);

// Repository code reads DATABASE_URL. It must only ever receive the explicit
// isolated test URL supplied by this command.
process.env.DATABASE_URL = testDatabaseUrl;

function buildFixture(overrides: Partial<Opportunity> & { id: string; slug: string }): Opportunity {
  return {
    entity: 'Test Entity',
    entityShort: 'TE',
    title: 'Test Opportunity',
    type: 'Empleo público',
    region: 'Lima',
    modality: 'Presencial',
    level: 'Profesional',
    careers: ['Administración'],
    vacancies: 1,
    closingDate: '2099-12-31',
    officialUrl: 'https://www.example.com/convocatoria',
    summary: 'Integration test fixture — safe to delete.',
    beforeApplying: 'Read the official page.',
    requirements: ['Requirement 1'],
    status: 'published',
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'integration@test',
    publishedAt: new Date().toISOString(),
    isDemo: false,
    featured: false,
    color: '#000000',
    ...overrides,
  };
}

test('db integration: repository isolated round-trip', async (t) => {
  const [
    { eq },
    {
      getAllOpportunities,
      getPublicOpportunities,
      getOpportunityBySlug,
      getOpportunityById,
      saveOpportunity,
      recordEvent,
    },
    { db },
    { opportunities, events },
  ] = await Promise.all([
    import('drizzle-orm'),
    import('../../src/lib/repository'),
    import('../../src/lib/db/index'),
    import('../../src/lib/db/schema'),
  ]);

  const tag = `__test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pub = buildFixture({ id: `${tag}-pub`, slug: `${tag}-pub` });
  const draft = buildFixture({
    id: `${tag}-draft`,
    slug: `${tag}-draft`,
    title: 'Draft Fixture',
    status: 'draft',
  });
  const fixtureIds = [pub.id, draft.id];

  try {
    await saveOpportunity(pub);
    await saveOpportunity(draft);

    await t.test('saveOpportunity insert is readable via getOpportunityById', async () => {
      const found = await getOpportunityById(pub.id);
      assert.ok(found, 'inserted fixture should be found by id');
      assert.equal(found.slug, pub.slug);
      assert.equal(found.title, pub.title);
    });

    await t.test('getOpportunityBySlug round-trip returns the published fixture', async () => {
      const found = await getOpportunityBySlug(pub.slug);
      assert.ok(found, 'published fixture should be reachable by slug');
      assert.equal(found.id, pub.id);
    });

    await t.test('saveOpportunity upsert updates without duplicating', async () => {
      const updatedTitle = `${pub.title} (updated)`;
      await saveOpportunity({ ...pub, title: updatedTitle });
      const found = await getOpportunityById(pub.id);
      assert.ok(found, 'fixture should still exist after upsert');
      assert.equal(found.title, updatedTitle);
      const all = await getAllOpportunities();
      assert.equal(
        all.filter((item) => item.id === pub.id).length,
        1,
        'upsert must not create a duplicate row',
      );
    });

    await t.test('getAllOpportunities contains the fixture', async () => {
      const all = await getAllOpportunities();
      assert.ok(
        all.some((item) => item.id === pub.id),
        'fixture should be present in getAllOpportunities',
      );
    });

    await t.test('getPublicOpportunities shows published fixture and hides draft', async () => {
      const visible = await getPublicOpportunities();
      assert.ok(
        visible.some((item) => item.id === pub.id),
        'published fixture should be visible publicly',
      );
      assert.ok(
        visible.every((item) => item.id !== draft.id),
        'draft fixture must not be visible publicly',
      );
      assert.equal(await getOpportunityBySlug(draft.slug), undefined);
    });

    await t.test('recordEvent inserts and truncates fields to 160 chars', async () => {
      await recordEvent({
        name: 'x'.repeat(200),
        opportunityId: pub.id,
        source: 'integration',
        campaign: tag,
      });
      const rows = await db.select().from(events).where(eq(events.campaign, tag));
      assert.equal(rows.length, 1, 'exactly one event row should exist for the marker');
      assert.equal(rows[0]?.name.length, 160, 'event name must be truncated to 160 chars');
      assert.equal(rows[0]?.opportunityId, pub.id);
    });
  } finally {
    // Never leak fixture rows — and never touch the seeded demo rows
    // (all fixture ids/slugs carry the unique __test- prefix).
    try {
      await db.delete(events).where(eq(events.campaign, tag));
    } catch {
      // best-effort cleanup
    }
    for (const id of fixtureIds) {
      try {
        await db.delete(opportunities).where(eq(opportunities.id, id));
      } catch {
        // best-effort cleanup
      }
    }
  }
});
