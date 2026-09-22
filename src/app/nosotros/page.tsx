import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Nosotros",
  description: "Conoce el propósito y el criterio editorial de Oportunia.",
  alternates: { canonical: "/nosotros" },
};

export default function AboutPage() {
  return <InformationPage eyebrow="POR QUÉ EXISTIMOS" title="Información clara para decidir tu próximo paso." intro="Oportunia reúne oportunidades laborales, prácticas y programas en Perú para que comparar opciones y llegar a la fuente oficial sea más simple."><section><h2>Qué hacemos</h2><p>Organizamos información pública de convocatorias y presentamos fechas, requisitos, modalidad y procedencia en un formato legible. No recibimos postulaciones y no representamos a las entidades que publican las oportunidades.</p></section><section><h2>Cómo trabajamos</h2><p>Una ficha publicada debe identificar su fuente oficial y su revisión editorial. Las entidades pueden cambiar plazos o condiciones, por eso la fuente oficial siempre prevalece. El contenido de demostración se identifica como tal y no se presenta como convocatoria vigente.</p></section><section><h2>Quién opera el sitio</h2><p>Oportunia es un proyecto independiente operado en Perú por una persona natural con RUC. No publicamos un número de RUC, domicilio o identidad legal hasta contar con datos verificados y una decisión expresa de hacerlos públicos.</p></section></InformationPage>;
}
