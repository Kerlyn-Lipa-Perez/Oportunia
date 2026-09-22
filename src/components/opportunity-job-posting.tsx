import { getDeadline } from '@/lib/opportunities';
import type { Opportunity } from '@/lib/types';

type JsonObject = Record<string, unknown>;

function validPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function salaryData(value: string | undefined): JsonObject | undefined {
  if (!value || !/(?:S\/?|PEN|sol(?:es)?)/i.test(value)) return undefined;
  const amounts = value.match(/\d[\d,.]*/g)
    ?.map((amount) => Number(amount.replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (!amounts?.length) return undefined;

  const quantity: JsonObject = amounts.length > 1
    ? { '@type': 'QuantitativeValue', minValue: Math.min(...amounts), maxValue: Math.max(...amounts) }
    : { '@type': 'QuantitativeValue', value: amounts[0] };
  return { '@type': 'MonetaryAmount', currency: 'PEN', value: quantity };
}

function readableText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function completeSentence(value: string): string {
  return /[.!?]$/u.test(value) ? value : `${value}.`;
}

function visibleJobDescription(opportunity: Opportunity): string {
  const summary = completeSentence(readableText(opportunity.summary));
  const requirements = opportunity.requirements
    .map(readableText)
    .filter(Boolean)
    .join('; ');
  const beforeApplying = readableText(opportunity.beforeApplying);

  return [
    summary,
    requirements ? `Requisitos: ${completeSentence(requirements)}` : '',
    beforeApplying ? `Antes de postular: ${completeSentence(beforeApplying)}` : '',
  ].filter(Boolean).join(' ');
}

export function buildJobPostingJsonLd(
  opportunity: Opportunity,
  siteUrl: string,
  now = new Date(),
): JsonObject | null {
  const complete = opportunity.type !== 'Becas y programas'
    && opportunity.status === 'published'
    && !opportunity.isDemo
    && !!opportunity.verifiedBy.trim()
    && !!opportunity.verifiedAt
    && Number.isFinite(Date.parse(opportunity.verifiedAt))
    && !!opportunity.publishedAt
    && Number.isFinite(Date.parse(opportunity.publishedAt))
    && !!opportunity.title.trim()
    && !!opportunity.entity.trim()
    && !!opportunity.summary.trim()
    && validPublicUrl(opportunity.officialUrl)
    && !getDeadline(opportunity.closingDate, now).closed;
  if (!complete) return null;

  const data: JsonObject = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opportunity.title,
    description: visibleJobDescription(opportunity),
    datePosted: opportunity.publishedAt,
    validThrough: `${opportunity.closingDate.slice(0, 10)}T23:59:59-05:00`,
    url: opportunity.officialUrl,
    directApply: false,
    hiringOrganization: { '@type': 'Organization', name: opportunity.entity },
  };

  const region = opportunity.region.trim();
  if (opportunity.modality === 'Remoto') {
    data.jobLocationType = 'TELECOMMUTE';
    data.applicantLocationRequirements = { '@type': 'Country', name: 'Peru' };
  } else if (region) {
    data.jobLocation = {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: region, addressCountry: 'PE' },
    };
  }

  const baseSalary = salaryData(opportunity.salary);
  if (baseSalary) data.baseSalary = baseSalary;

  const canonicalSite = siteUrl.replace(/\/$/, '');
  data.identifier = {
    '@type': 'PropertyValue',
    name: 'Oportunia',
    value: `${canonicalSite}/convocatorias/${opportunity.slug}`,
  };
  return data;
}

export function serializeJsonLd(value: JsonObject): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function OpportunityJobPostingJsonLd({ opportunity, siteUrl }: { opportunity: Opportunity; siteUrl: string }) {
  const jsonLd = buildJobPostingJsonLd(opportunity, siteUrl);
  if (!jsonLd) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />;
}
