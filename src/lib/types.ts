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
