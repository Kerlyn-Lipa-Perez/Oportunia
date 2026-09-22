import type { ReactNode } from "react";
import { Footer, Header } from "@/components/portal";

export function InformationPage({
  eyebrow,
  title,
  intro,
  children,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  updated?: string;
}) {
  return <><Header /><main className="information-page container"><header className="information-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p>{updated && <p className="legal-updated">Última actualización: {updated}</p>}</header><div className="information-body">{children}</div></main><Footer /></>;
}
