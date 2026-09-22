export type OpportunityType = 'Empleo público' | 'Prácticas' | 'Empleo privado' | 'Becas y programas';
export type OpportunityStatus = 'draft' | 'published' | 'closed' | 'scheduled';
export interface Opportunity {
  id: string; slug: string; entity: string; entityShort: string; title: string;
  type: OpportunityType; region: string; modality: 'Presencial' | 'Híbrido' | 'Remoto';
  level: string; careers: string[]; vacancies: number; closingDate: string;
  officialUrl: string; summary: string; beforeApplying: string; requirements: string[];
  salary?: string; status: OpportunityStatus; verifiedAt: string; verifiedBy: string;
  publishedAt: string; isDemo: boolean; featured: boolean; color: string;
}

export const trackableEventNames = ['view', 'official_click', 'save', 'landing_view', 'detail_view', 'engagement'] as const;
export type TrackableEventName = (typeof trackableEventNames)[number];

export function isTrackableEventName(value: unknown): value is TrackableEventName {
  return typeof value === 'string' && (trackableEventNames as readonly string[]).includes(value);
}

export type SocialPlatform = 'tiktok';
export type SocialCampaignStatus = 'draft' | 'approved' | 'queued' | 'published' | 'failed';

export interface SocialCampaign {
  id: string;
  opportunityId: string;
  platform: SocialPlatform;
  code: string;
  hook: string;
  script: string;
  coverText: string;
  caption: string;
  publishedUrl: string | null;
  publishedAt: string | null;
  status: SocialCampaignStatus;
  reviewer: string | null;
  approvedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
