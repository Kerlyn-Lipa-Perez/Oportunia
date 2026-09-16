import Link from "next/link";

export default function NotFound() {
  return <main style={{ maxWidth: 640, margin: "15vh auto", padding: 24 }}><p>OPORTUNIA · 404</p><h1>Esta oportunidad no está disponible</h1><p>Es posible que el enlace haya cambiado o que la publicación ya no esté visible.</p><Link href="/">Volver a las oportunidades →</Link></main>;
}
