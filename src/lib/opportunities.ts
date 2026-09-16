import type { Opportunity } from './types';

export const opportunityTypes = ['Empleo público', 'Prácticas', 'Empleo privado', 'Becas y programas'] as const;
export const modalities = ['Presencial', 'Híbrido', 'Remoto'] as const;
export const levels = ['Estudiante', 'Egresado', 'Técnico', 'Profesional'] as const;
export const regions = ['Lima', 'Arequipa', 'Cusco', 'La Libertad', 'Piura', 'Junín', 'A nivel nacional'] as const;

export function limaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function getDeadline(closingDate: string, now = new Date()) {
  const date = closingDate.slice(0, 10);
  const days = Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${limaDate(now)}T00:00:00Z`)) / 86400000);
  const closed = !Number.isFinite(days) || days < 0;
  return { label: closed ? 'Convocatoria cerrada' : days === 0 ? 'Cierra hoy' : days === 1 ? 'Cierra mañana' : `Cierra en ${days} días`, days, closed, urgent: !closed && days <= 3 };
}

export function isPublicOpportunity(value: Pick<Opportunity, 'status'> & Partial<Pick<Opportunity, 'publishedAt'>>, now = new Date()) {
  return value.status === 'published' || value.status === 'closed' || (value.status === 'scheduled' && !!value.publishedAt && Date.parse(value.publishedAt) <= now.getTime());
}

export function validateOpportunity(value: Partial<Opportunity>): string[] {
  const errors: string[] = [];
  const publishing = value.status === 'published' || value.status === 'scheduled';
  const publicEntry = publishing || value.status === 'closed';
  if (!value.entity?.trim()) errors.push('La entidad es obligatoria.');
  if (!value.title?.trim()) errors.push('El título es obligatorio.');
  if (value.closingDate && (!/^\d{4}-\d{2}-\d{2}$/.test(value.closingDate) || !Number.isFinite(Date.parse(value.closingDate)) || new Date(value.closingDate).toISOString().slice(0, 10) !== value.closingDate)) errors.push('Ingresá una fecha de cierre válida.');
  if (!value.status || !['draft', 'published', 'closed', 'scheduled'].includes(value.status)) errors.push('Estado no válido.');
  if (value.type && !opportunityTypes.includes(value.type)) errors.push('Tipo no válido.');
  if (value.modality && !modalities.includes(value.modality)) errors.push('Modalidad no válida.');
  if (value.officialUrl) {
    try {
      const url = new URL(value.officialUrl);
      if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.hostname === 'localhost') throw new Error();
    } catch { errors.push('La URL oficial debe ser una dirección HTTPS pública válida.'); }
  }
  if (publicEntry) {
    if (!value.officialUrl) errors.push('La URL oficial es obligatoria.');
    if (!value.closingDate) errors.push('La fecha de cierre es obligatoria.');
    else if (publishing && getDeadline(value.closingDate).closed) errors.push('No se puede publicar una convocatoria vencida.');
    if (!value.verifiedBy?.trim()) errors.push('Registrá al responsable de verificación.');
    if (!value.region?.trim()) errors.push('La región es obligatoria.');
    if (!value.careers?.length) errors.push('Agregá al menos una carrera o perfil.');
    if (!Number.isInteger(value.vacancies) || Number(value.vacancies) < 1) errors.push('Las vacantes deben ser un número entero mayor que cero.');
    if (!value.beforeApplying?.trim()) errors.push('Completá Antes de postular.');
    if (!value.summary?.trim()) errors.push('El resumen es obligatorio.');
    if (!value.type || !value.modality || !value.level) errors.push('Completá tipo, modalidad y nivel.');
  }
  if (value.status === 'scheduled') {
    if (!value.publishedAt || !Number.isFinite(Date.parse(value.publishedAt)) || Date.parse(value.publishedAt) <= Date.now()) errors.push('La programación debe indicar una fecha futura.');
    else if (value.closingDate && limaDate(new Date(value.publishedAt)) > value.closingDate) errors.push('La publicación programada debe ocurrir antes del cierre.');
  }
  return errors;
}
