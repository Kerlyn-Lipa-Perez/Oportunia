import type { Metadata } from "next";
import { OpportunityExplorer } from "@/components/portal";
import { getPublicOpportunities } from "@/lib/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const opportunities = await getPublicOpportunities();
  return <OpportunityExplorer opportunities={opportunities} />;
}
