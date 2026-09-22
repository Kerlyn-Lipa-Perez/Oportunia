import { getDeadline } from '@/lib/opportunities';
import type { Opportunity, SocialCampaign } from '@/lib/types';

export type PublicTikTokCampaign = {
  campaign: SocialCampaign;
  opportunity: Opportunity;
};

export function buildTikTokDetailHref(slug: string, code: string): string {
  const params = new URLSearchParams({
    utm_source: 'tiktok',
    utm_medium: 'organic_social',
    utm_campaign: 'convocatorias',
    utm_content: code,
  });
  return `/convocatorias/${encodeURIComponent(slug)}?${params.toString()}`;
}

export function selectPublicTikTokCampaigns(
  campaigns: readonly SocialCampaign[],
  opportunities: readonly Opportunity[],
  now = new Date(),
): PublicTikTokCampaign[] {
  const opportunitiesById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

  return campaigns
    .filter((campaign) => campaign.platform === 'tiktok' && campaign.status === 'published')
    .map((campaign) => ({ campaign, opportunity: opportunitiesById.get(campaign.opportunityId) }))
    .filter((entry): entry is PublicTikTokCampaign => {
      const opportunity = entry.opportunity;
      return !!opportunity
        && opportunity.status === 'published'
        && !opportunity.isDemo
        && !!opportunity.verifiedBy.trim()
        && !!opportunity.verifiedAt
        && Number.isFinite(Date.parse(opportunity.verifiedAt))
        && !getDeadline(opportunity.closingDate, now).closed;
    })
    .sort((a, b) => (b.campaign.publishedAt || '').localeCompare(a.campaign.publishedAt || ''));
}
