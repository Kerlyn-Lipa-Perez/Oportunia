import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appProfiles } from '@/lib/db/schema';
import type { TeamProfile } from '@/lib/team-management';

function asTeamProfile(profile: typeof appProfiles.$inferSelect): TeamProfile {
  return { ...profile, role: profile.role as TeamProfile['role'] };
}

export const teamProfileRepository = {
  async list(): Promise<TeamProfile[]> {
    return (await db.select().from(appProfiles)).map(asTeamProfile);
  },
  async get(userId: string): Promise<TeamProfile | null> {
    const rows = await db.select().from(appProfiles).where(eq(appProfiles.userId, userId)).limit(1);
    return rows[0] ? asTeamProfile(rows[0]) : null;
  },
  async upsert(profile: TeamProfile): Promise<TeamProfile> {
    const rows = await db.insert(appProfiles).values(profile).onConflictDoUpdate({
      target: appProfiles.userId,
      set: { role: profile.role, suspended: profile.suspended, updatedAt: profile.updatedAt },
    }).returning();
    if (!rows[0]) throw new Error('Profile write did not return a row.');
    return asTeamProfile(rows[0]);
  },
};
