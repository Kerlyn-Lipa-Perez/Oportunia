import type { Metadata } from "next";
import { OpportunityExplorer } from "@/components/portal";
import { getPublicOpportunities } from "@/lib/repository";

export const metadata: Metadata = { title: "Tus oportunidades guardadas | Oportunia", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  return <OpportunityExplorer opportunities={await getPublicOpportunities()} onlySaved />;
}
