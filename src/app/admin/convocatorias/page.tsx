import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import { getAllOpportunities } from '@/lib/repository';
import ConvocatoriasPanel from './panel';

export default async function ConvocatoriasPage() {
  const access = await requireEditorial();
  if (!isEditorialAccess(access)) return null;
  return <ConvocatoriasPanel editor={access.user.email || access.user.id} initial={await getAllOpportunities()} />;
}
