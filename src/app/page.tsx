import { OpportunityExplorer } from "@/components/portal";
import { getPublicOpportunities } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const opportunities = await getPublicOpportunities();
  return <OpportunityExplorer opportunities={opportunities} />;
}
