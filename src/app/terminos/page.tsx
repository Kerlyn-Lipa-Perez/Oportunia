import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";

export const metadata: Metadata = {
  title: "Términos",
  description: "Condiciones de uso del catálogo de oportunidades de Oportunia.",
  alternates: { canonical: "/terminos" },
};

export default function TermsPage() {
  return <InformationPage eyebrow="USO RESPONSABLE" title="Términos de uso" intro="Estas condiciones explican el alcance del catálogo y las responsabilidades al consultar una oportunidad." updated="20 de septiembre de 2026"><section><h2>Servicio informativo</h2><p>Oportunia organiza información sobre oportunidades y dirige a la fuente oficial. No es empleador, agencia de colocación ni representante de las entidades, y no recibe postulaciones.</p></section><section><h2>La fuente oficial prevalece</h2><p>Aunque revisamos la información publicada, una entidad puede modificar bases, cronogramas, vacantes o requisitos. Antes de tomar una decisión, confirma siempre la versión vigente en el enlace oficial.</p></section><section><h2>Sin cobros por postular</h2><p>Oportunia no cobra a postulantes. Desconfía de solicitudes de pago, claves o datos bancarios atribuidas al sitio y repórtalas por el canal de contacto cuando esté habilitado.</p></section><section><h2>Uso permitido</h2><p>Puedes usar el catálogo para fines personales e informativos. No debes interferir con el servicio, intentar acceder a áreas restringidas, suplantar a una entidad ni reutilizar el contenido de forma engañosa.</p></section><section><h2>Cambios</h2><p>Podemos actualizar el servicio y estos términos para reflejar funciones reales o requisitos aplicables. La fecha de actualización se mostrará en esta página.</p></section></InformationPage>;
}
