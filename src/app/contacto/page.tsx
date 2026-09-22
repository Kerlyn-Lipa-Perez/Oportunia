import type { Metadata } from "next";
import { InformationPage } from "@/components/information-page";
import { resolveSiteConfig } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Canal de contacto de Oportunia para consultas editoriales y de privacidad.",
  alternates: { canonical: "/contacto" },
};

export default function ContactPage() {
  const { contactEmail } = resolveSiteConfig();
  return <InformationPage eyebrow="HABLEMOS" title="Contacto" intro="Este canal está destinado a correcciones editoriales, consultas sobre privacidad y comunicaciones relacionadas con el sitio."><section><h2>Canal disponible</h2>{contactEmail ? <p>Escríbenos a <a className="text-link" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Incluye la URL de la ficha cuando quieras reportar una corrección.</p> : <p>El correo público de contacto todavía no ha sido verificado ni habilitado. No mostramos una dirección de ejemplo para evitar que una consulta llegue a un destinatario incorrecto. Esta página se actualizará cuando el canal real esté disponible.</p>}</section><section><h2>Consultas sobre convocatorias</h2><p>Oportunia no gestiona postulaciones. Para requisitos, documentos, resultados o cambios de cronograma, contacta directamente a la entidad mediante la fuente oficial indicada en cada ficha.</p></section><section><h2>Datos que no debes enviar</h2><p>No envíes contraseñas, números de tarjeta, datos bancarios ni documentación personal sensible. Oportunia nunca cobra por postular.</p></section></InformationPage>;
}
