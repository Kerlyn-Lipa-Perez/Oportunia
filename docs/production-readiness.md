# Activar producción sin abrir gates antes de tiempo

El repositorio mantiene SEO y AdSense cerrados por defecto. El código resuelve canonical, redirects y validación; DNS, el dominio de Vercel, AdSense y la CMP requieren configuración externa verificada.

## Ruta rápida

1. Agregá `oportuniape.com` al proyecto correcto en Vercel y configurá los registros DNS que Vercel indique.
2. Verificá que `https://oportunia-six.vercel.app/<ruta>` responda con `308` hacia `https://oportuniape.com/<ruta>` y que el certificado del dominio canónico sea válido.
3. Desplegá con `NEXT_PUBLIC_SITE_URL=https://oportuniape.com` y mantené `SEO_INDEXING_ENABLED=false` hasta completar la lista de verificación.
4. Configurá AdSense, la propiedad de GA4 y la CMP certificada de Google fuera del repositorio. Recién después de pasar la evaluación interna y tener el sitio marcado como AdSense Ready, cargá los IDs reales y configurá `ADSENSE_READINESS_CONFIRMED=true`; `ADSENSE_ENABLED=true` sigue siendo el kill switch operativo.

## Configuración

| Tema | Decisión |
|---|---|
| Canonical | Sólo `https://oportuniape.com`; producción nunca deriva canonical desde el hostname de Vercel. |
| Redirect | `next.config.ts` hace match exacto del host legado. La asociación de dominios y DNS siguen siendo tareas de Vercel. |
| SEO | `SEO_INDEXING_ENABLED=true` funciona únicamente en producción con la URL canónica configurada. Cualquier otro estado bloquea robots y vacía sitemap. |
| AdSense | Requiere `ADSENSE_ENABLED=true`, `ADSENSE_READINESS_CONFIRMED=true`, un `ADSENSE_PUBLISHER_ID=pub-...` válido y un slot numérico permitido. `ADSENSE_SLOT_CATALOG_END` corresponde al cierre del catálogo y `ADSENSE_SLOT_DETAIL_BODY` al cuerpo de la ficha; cada posición se valida por separado y nunca comparte un ID de respaldo. La confirmación de readiness se configura sólo después de superar la evaluación interna y obtener AdSense Ready. No uses IDs de ejemplo. |
| Consentimiento | La CMP certificada debe resolver la elección y adaptar su resultado al evento `oportunia:ads-consent`. El sitio no incluye un banner propio ni lo considera reemplazo de la CMP. |
| ads.txt | Devuelve `404` hasta que AdSense esté habilitado, readiness esté confirmado y exista un publisher válido. |
| Analítica | `NEXT_PUBLIC_GA_MEASUREMENT_ID` acepta únicamente el ID `G-...` real de la propiedad de GA4. Vacío o inválido deshabilita la integración. El script y los `page_view` se cargan sólo después del evento de consentimiento concedido; rechazo, ausencia, error o revocación cierran el gate. Si el tag ya fue cargado, la revocación activa `ga-disable-G-...` y actualiza `analytics_storage` a `denied` para impedir hits futuros; no borra datos ya procesados. Crear la propiedad, vincular GA4 con AdSense y validar la medición son tareas externas: no inventes IDs en el repositorio. |

## Lista de verificación

- [ ] `oportuniape.com` resuelve por DNS y figura como dominio verificado en Vercel.
- [ ] El hostname `oportunia-six.vercel.app` redirige rutas y query strings al canónico.
- [ ] Las páginas legales muestran sólo datos reales verificados.
- [ ] `robots.txt` bloquea antes del lanzamiento y permite sólo después de activar el gate.
- [ ] `sitemap.xml` no contiene demos ni oportunidades cerradas.
- [ ] La cuenta de AdSense está lista y los IDs reales están cargados sólo en variables de entorno.
- [ ] La evaluación interna fue aprobada y AdSense Ready está confirmado antes de configurar `ADSENSE_READINESS_CONFIRMED=true`.
- [ ] La CMP certificada fue probada para conceder, rechazar y retirar consentimiento.
- [ ] No existe una solicitud de `adsbygoogle.js` antes del consentimiento concedido.
- [ ] La propiedad de GA4 usa el Measurement ID real en `NEXT_PUBLIC_GA_MEASUREMENT_ID` y no existe una solicitud de `gtag.js` ni eventos antes del consentimiento concedido.
- [ ] El vínculo GA4 ↔ AdSense fue realizado y verificado en las consolas externas correspondientes.

## E2E móvil del embudo TikTok

El arnés de Playwright sólo corre contra un entorno de prueba ya desplegado. No inicia Next localmente, no carga archivos `.env` y no consulta variables de base de datos.

Prerequisitos:

- La migración `drizzle/0002_add_social_campaigns.sql` está aplicada en el entorno externo.
- Existe al menos una campaña TikTok `published` asociada a una oportunidad publicada, vigente, revisada y no demo. La ausencia de este fixture falla el test explícitamente.
- `E2E_BASE_URL` o `PLAYWRIGHT_BASE_URL` apunta al origen HTTP(S) externo del entorno; localhost y loopback se rechazan.
- El browser de Playwright para Chromium ya está instalado en la máquina que ejecuta la prueba. El repositorio no lo instala como parte del script.

En PowerShell:

```powershell
$env:E2E_BASE_URL='https://preview.example.test'
pnpm test:e2e
```

Para validar que Playwright puede cargar la configuración y descubrir el spec sin abrir un browser, usá `pnpm exec playwright test --list` con la misma variable definida.

## Tests de base de datos

`pnpm test` nunca incluye integración. Para una rama Neon aislada, configurá `TEST_DATABASE_URL`, confirmá que no apunta a producción y ejecutá con `ALLOW_DATABASE_TESTS=true pnpm test:integration` (en PowerShell, definí ambas variables de entorno antes del comando). La integración nunca lee `.env` ni reutiliza `DATABASE_URL` implícitamente.
