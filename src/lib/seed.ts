import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { opportunities } from './db/schema';
import type { Opportunity } from './types';
import { limaDate } from './opportunities';

const SAMPLES: Array<[string, string, string, Opportunity['type'], string, string, string, number, number, string, string]> = [
  ['sunat-practicante-administracion', 'SUNAT', 'Practicante preprofesional de Administración', 'Prácticas', 'Lima', 'Administración', 'Estudiante', 12, 2, 'S/ 1,130', '#d94d42'],
  ['bcp-jovenes-talentos', 'BCP', 'Programa Jóvenes Talentos 2026', 'Empleo privado', 'Lima', 'Ingeniería de Sistemas', 'Egresado', 24, 7, 'A convenir', '#003b82'],
  ['minedu-analista-administrativo', 'Ministerio de Educación', 'Analista administrativo', 'Empleo público', 'Lima', 'Administración', 'Profesional', 8, 1, 'S/ 4,500', '#b02b43'],
  ['osiptel-practicas-ingenieria', 'OSIPTEL', 'Prácticas profesionales en Ingeniería', 'Prácticas', 'A nivel nacional', 'Ingeniería Industrial', 'Egresado', 16, 5, 'S/ 1,500', '#1557aa'],
  ['pronabec-beca-talento', 'PRONABEC', 'Programa de formación para jóvenes', 'Becas y programas', 'A nivel nacional', 'Todas las carreras', 'Estudiante', 50, 12, 'Financiamiento educativo', '#008b80'],
  ['sunarp-asistente-registral', 'SUNARP', 'Asistente registral', 'Empleo público', 'Arequipa', 'Derecho', 'Profesional', 6, 4, 'S/ 3,200', '#c74337'],
  ['interbank-practicante-datos', 'Interbank', 'Practicante de análisis de datos', 'Prácticas', 'Lima', 'Ingeniería de Sistemas', 'Estudiante', 4, 9, 'A convenir', '#008b54'],
  ['gobierno-cusco-proyectos', 'Gobierno Regional del Cusco', 'Especialista en proyectos públicos', 'Empleo público', 'Cusco', 'Ingeniería Civil', 'Profesional', 3, 6, 'S/ 5,000', '#80643e'],
];

const URLS = [
  'https://www.sunat.gob.pe/',
  'https://www.viabcp.com/',
  'https://www.gob.pe/minedu',
  'https://www.osiptel.gob.pe/',
  'https://www.pronabec.gob.pe/',
  'https://www.gob.pe/sunarp',
  'https://interbank.pe/',
  'https://www.gob.pe/regioncusco',
];

function buildOpportunity(
  [slug, entity, title, type, region, career, level, vacancies, days, salary, color]: typeof SAMPLES[number],
  index: number,
): Opportunity {
  return {
    id: `demo-${index + 1}`,
    slug,
    entity,
    entityShort:
      entity === 'Ministerio de Educación'
        ? 'MINEDU'
        : entity === 'Gobierno Regional del Cusco'
          ? 'GRC'
          : entity,
    title,
    type,
    region,
    modality: index === 1 || index === 6 ? 'Híbrido' : 'Presencial',
    level,
    careers: [career],
    vacancies,
    closingDate: limaDate(new Date(Date.now() + days * 86400000)),
    officialUrl: URLS[index],
    summary: `Ejemplo de una oportunidad de ${type.toLowerCase()} para perfiles de ${career.toLowerCase()}. Esta ficha permite explorar Oportunia; no corresponde a una convocatoria vigente verificada.`,
    beforeApplying:
      'Esta es una ficha de demostración. Consultá el portal de la entidad para conocer sus convocatorias reales. Nunca pagues por participar en un proceso de selección.',
    requirements: [
      `Formación en ${career} o carreras afines.`,
      'Revisar el perfil y las bases de la convocatoria real.',
      'Preparar CV y documentos de sustento según las bases.',
    ],
    salary,
    status: 'published',
    verifiedAt: '',
    verifiedBy: '',
    publishedAt: new Date().toISOString(),
    isDemo: true,
    featured: index < 3,
    color,
  };
}

export async function seedOpportunities(): Promise<Opportunity[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required for seeding. ' +
      'Copy .env.example to .env.local and set DATABASE_URL to your Neon connection string.'
    );
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  const ops = SAMPLES.map((sample, i) => buildOpportunity(sample, i));

  for (const opp of ops) {
    await db
      .insert(opportunities)
      .values({
        id: opp.id,
        slug: opp.slug,
        data: JSON.stringify(opp),
      })
      .onConflictDoUpdate({
        target: opportunities.id,
        set: { slug: opp.slug, data: JSON.stringify(opp) },
      });
  }

  return ops;
}

// Run as standalone script: npx tsx src/lib/seed.ts
const isMain = process.argv[1]?.endsWith('seed.ts');
if (isMain) {
  seedOpportunities()
    .then((ops) => {
      console.log(`Seeded ${ops.length} opportunities.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
