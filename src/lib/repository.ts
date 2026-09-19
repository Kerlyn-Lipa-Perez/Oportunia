import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Opportunity } from './types';
import { getDeadline, isPublicOpportunity } from './opportunities';
import { db } from './db';
import { opportunities, events } from './db/schema';

export async function getAllOpportunities(): Promise<Opportunity[]> {
  const rows = await db.select().from(opportunities);
  return rows.map((row) => JSON.parse(row.data) as Opportunity);
}

export async function getPublicOpportunities(): Promise<Opportunity[]> {
  const all = await getAllOpportunities();
  return all
    .filter((item) => isPublicOpportunity(item))
    .map((item) => ({
      ...item,
      status: getDeadline(item.closingDate).closed
        ? ('closed' as const)
        : item.status === 'scheduled'
          ? ('published' as const)
          : item.status,
    }));
}

export async function getOpportunityBySlug(slug: string): Promise<Opportunity | undefined> {
  const all = await getPublicOpportunities();
  return all.find((item) => item.slug === slug);
}

export async function getOpportunityById(id: string): Promise<Opportunity | undefined> {
  const all = await getAllOpportunities();
  return all.find((item) => item.id === id);
}

export async function saveOpportunity(opportunity: Opportunity): Promise<Opportunity> {
  await db
    .insert(opportunities)
    .values({
      id: opportunity.id,
      slug: opportunity.slug,
      data: JSON.stringify(opportunity),
    })
    .onConflictDoUpdate({
      target: opportunities.id,
      set: { slug: opportunity.slug, data: JSON.stringify(opportunity) },
    });
  return opportunity;
}

export async function recordEvent(data: {
  name: string;
  opportunityId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
}): Promise<void> {
  const clean = (value?: string) => (value || '').slice(0, 160);
  await db.insert(events).values({
    id: randomUUID(),
    name: clean(data.name),
    opportunityId: clean(data.opportunityId),
    source: clean(data.source),
    medium: clean(data.medium),
    campaign: clean(data.campaign),
    content: clean(data.content),
    createdAt: new Date().toISOString(),
  });
}
