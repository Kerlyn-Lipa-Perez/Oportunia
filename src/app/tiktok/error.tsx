'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import './tiktok.css';

export default function TikTokError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('No se pudo cargar la ruta de TikTok.', error);
  }, [error]);

  return <main className="tiktok-error-page container" role="alert" aria-labelledby="tiktok-error-title">
    <div className="tiktok-error">
      <span className="tiktok-error-icon" aria-hidden="true"><AlertTriangle size={25} /></span>
      <p className="eyebrow">NO PUDIMOS CARGAR LOS VIDEOS</p>
      <h1 id="tiktok-error-title">Algo falló al consultar las convocatorias.</h1>
      <p>No mostramos un listado vacío porque no pudimos verificar los datos. Intenta nuevamente o revisa el catálogo completo.</p>
      <div className="tiktok-error-actions">
        <button className="button button-primary" type="button" onClick={() => retry()}><RefreshCw size={17} /> Intentar nuevamente</button>
        <Link className="button button-secondary" href="/#oportunidades">Explorar oportunidades <ArrowRight size={17} /></Link>
      </div>
    </div>
  </main>;
}
