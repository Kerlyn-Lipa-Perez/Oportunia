import type { Metadata } from 'next';
import { getDeadline } from '../opportunities';
import type { Opportunity } from '../types';

type OpportunityMetadataInput = Pick<
  Opportunity,
  'title' | 'entity' | 'summary' | 'slug' | 'status' | 'closingDate' | 'isDemo'
>;

export function isOpportunityIndexable(
  opportunity: OpportunityMetadataInput,
  now = new Date(),
): boolean {
  return opportunity.status === 'published'
    && !opportunity.isDemo
    && !getDeadline(opportunity.closingDate, now).closed;
}

export function buildOpportunityMetadata(
  opportunity: OpportunityMetadataInput,
  now = new Date(),
): Metadata {
  const title = `${opportunity.title} en ${opportunity.entity} | Oportunia`;
  const indexable = isOpportunityIndexable(opportunity, now);

  return {
    title,
    description: opportunity.summary,
    alternates: { canonical: `/convocatorias/${encodeURIComponent(opportunity.slug)}` },
    openGraph: {
      title,
      description: opportunity.summary,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: opportunity.summary,
    },
    robots: { index: indexable, follow: indexable },
  };
}
