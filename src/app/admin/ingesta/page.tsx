import { isEditorialAccess, requireEditorial } from '@/lib/auth';
import IngestionPanel from './panel';

export default async function IngestaPage() {
  const access = await requireEditorial();
  if (!isEditorialAccess(access)) return null;
  return <IngestionPanel />;
}
