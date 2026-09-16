import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Opportunity } from './types';
import { getDeadline, isPublicOpportunity } from './opportunities';
import { seedOpportunities } from './seed';

let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const path = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'oportunia.db');
  mkdirSync(dirname(path), { recursive: true });
  database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, name TEXT NOT NULL, opportunity_id TEXT, source TEXT, medium TEXT, campaign TEXT, content TEXT, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (!database.prepare("SELECT key FROM settings WHERE key = 'seeded'").get()) {
    for (const opportunity of seedOpportunities()) database.prepare('INSERT OR IGNORE INTO opportunities (id, slug, data) VALUES (?, ?, ?)').run(opportunity.id, opportunity.slug, JSON.stringify(opportunity));
    database.prepare("INSERT INTO settings (key, value) VALUES ('seeded', 'true')").run();
  }
  return database;
}

export function getAllOpportunities(): Opportunity[] {
  return (db().prepare('SELECT data FROM opportunities').all() as Array<{ data: string }>).map((row) => JSON.parse(row.data) as Opportunity);
}
export function getPublicOpportunities(): Opportunity[] {
  return getAllOpportunities().filter((item) => isPublicOpportunity(item)).map((item) => ({ ...item, status: getDeadline(item.closingDate).closed ? 'closed' as const : item.status === 'scheduled' ? 'published' as const : item.status }));
}
export function getOpportunityBySlug(slug: string): Opportunity | undefined { return getPublicOpportunities().find((item) => item.slug === slug); }
export function getOpportunityById(id: string): Opportunity | undefined { return getAllOpportunities().find((item) => item.id === id); }
export function saveOpportunity(opportunity: Opportunity) {
  db().prepare('INSERT INTO opportunities (id, slug, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, data=excluded.data').run(opportunity.id, opportunity.slug, JSON.stringify(opportunity));
  return opportunity;
}
export function recordEvent(data: { name: string; opportunityId?: string; source?: string; medium?: string; campaign?: string; content?: string }) {
  const clean = (value?: string) => (value || '').slice(0, 160);
  db().prepare('INSERT INTO events (id,name,opportunity_id,source,medium,campaign,content,created_at) VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), clean(data.name), clean(data.opportunityId), clean(data.source), clean(data.medium), clean(data.campaign), clean(data.content), new Date().toISOString());
}
