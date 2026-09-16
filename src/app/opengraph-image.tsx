import { ImageResponse } from 'next/og';

export const alt = 'Oportunia. Oportunidades claras. Decisiones informadas.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#0b2945', padding: '70px 80px', color: '#ffffff', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M47 14a24 24 0 1 0 8 27" fill="none" stroke="#67d7e5" strokeWidth="9" strokeLinecap="round" />
          <circle cx="54" cy="19" r="6" fill="#67d7e5" />
        </svg>
        <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1.5px' }}>oportunia</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 22, color: '#67d7e5', letterSpacing: '3px' }}>TU PRÓXIMO PASO EMPIEZA ACÁ</div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 66, fontWeight: 700, lineHeight: 1.1, maxWidth: 970 }}>
          <span>Oportunidades claras.</span>
          <span>Decisiones informadas.</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #34536a', paddingTop: 24, fontSize: 24, color: '#b8cad7' }}>
        <span>Empleo · Prácticas · Programas</span>
        <span>Hecho para Perú</span>
      </div>
    </div>,
    size,
  );
}
