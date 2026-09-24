# Activar producción sin abrir gates antes de tiempo

Producción permanece cerrada por defecto: SEO no indexa y AdSense no carga hasta que datos, dominio, consentimiento y medición estén verificados. La aplicación ya implementa los controles; Neon, Vercel y las consolas de Google requieren intervención humana.

## Ruta de salida

1. Conservá un snapshot de `production` y cloná una rama Neon aislada.
2. Confirmá el baseline `0000` y aplicá `0001`, `0002`, `0003` y `0004` en orden.
3. Ejecutá integración y el E2E externo completo contra un preview conectado a esa rama.
4. Promové la cuenta raíz en la rama siguiendo [el orden seguro](./neon-admin-provisioning.md).
5. Recién después de aprobar el E2E, repetí migración y promoción en producción.
6. Configurá dominio, CMP, la propiedad de GA4, AdSense y Search Console; abrí cada gate sólo cuando su checklist esté completo.

No borres los usuarios fixture ni la rama aislada hasta conservar la evidencia. Después, eliminá los fixtures y la rama de prueba; mantené el snapshot según la política de recuperación.

## Variables de Vercel

| Variable | Regla |
|---|---|
| `DATABASE_URL` | URL de la rama correspondiente; nunca apuntes un preview de aceptación a producción. |
| `NEON_AUTH_BASE_URL` | Endpoint de Auth de la misma rama que `DATABASE_URL`. |
| `NEON_AUTH_COOKIE_SECRET` | Secreto fuerte y exclusivo del entorno; no se versiona. |
| `NEXT_PUBLIC_SITE_URL` | `https://oportuniape.com` en producción. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ID real `G-...`; vacío mantiene GA4 apagado. |
| `SEO_INDEXING_ENABLED=false` | Estado obligatorio hasta aprobar el gate SEO. |
| `ADSENSE_ENABLED` | Kill switch; `false` hasta aprobar el gate AdSense. |
| `ADSENSE_READINESS_CONFIRMED` | `true` sólo con estado AdSense Ready y evaluación interna aprobada. |
| `ADSENSE_PUBLISHER_ID` y slots | IDs reales; nunca valores de ejemplo. |

## Gate SEO

Activá `SEO_INDEXING_ENABLED=true` únicamente cuando:

- [ ] `oportuniape.com` resuelve por DNS, tiene certificado válido y figura verificado en Vercel.
- [ ] El hostname legado redirige rutas y query strings al dominio canónico.
- [ ] Portada, `/admin`, fichas, `robots.txt` y `sitemap.xml` responden de forma estable.
- [ ] No existe ninguna URL productiva de localhost.
- [ ] Las oportunidades cerradas están fuera del sitemap, la indexación y el marcado `JobPosting`.
- [ ] Search Console verificó `oportuniape.com` y recibió el sitemap.
- [ ] Las páginas legales contienen únicamente información real verificada.

Con el gate cerrado, robots bloquea y el sitemap queda vacío.

## Gate AdSense y analítica

Activá `ADSENSE_READINESS_CONFIRMED=true` y luego `ADSENSE_ENABLED=true` únicamente cuando:

- [ ] La CMP certificada por Google fue probada al conceder, rechazar y retirar consentimiento.
- [ ] GA4 y AdSense permanecen sin requests ni eventos antes de consentimiento válido.
- [ ] La cuenta está en estado AdSense Ready y publisher, slots y `/ads.txt` usan IDs reales.
- [ ] GA4 está enlazado con AdSense y la medición fue verificada en ambas consolas.
- [ ] Hay cero contenido demo.
- [ ] Hay al menos 30 oportunidades vigentes y revisadas.
- [ ] Hay al menos 10 guías originales.
- [ ] Se acumularon dos semanas de tráfico TikTok medido sin patrones sospechosos.
- [ ] El E2E TikTok → ficha → fuente oficial fue aprobado.

`ads.txt` responde `404` mientras publicidad o readiness estén apagados. El consentimiento se adapta al evento `oportunia:ads-consent`; rechazo, ausencia, error o revocación cierran GA4 y AdSense.

## E2E contra el entorno migrado

Playwright exige un origen HTTP(S) externo ya desplegado; rechaza localhost, no inicia Next y no carga `.env`. El preview debe usar la rama aislada migrada y contener una campaña TikTok publicada asociada a una oportunidad vigente, revisada y no demo.

Configurá credenciales exclusivas de aceptación:

```powershell
$env:E2E_BASE_URL='https://preview.example.test'
$env:E2E_ADMIN_EMAIL='<admin-de-prueba>'
$env:E2E_ADMIN_PASSWORD='<secreto>'
$env:E2E_EDITOR_EMAIL='<editor-de-prueba>'
$env:E2E_EDITOR_PASSWORD='<secreto-de-12-o-mas-caracteres>'
pnpm test:e2e
```

El recorrido administrativo valida login, logout, restauración de sesión, creación o reutilización del editor, acceso editorial, rechazo en `/api/admin/users`, cambio de rol, suspensión, reactivación y autoprotección del administrador. `pnpm exec playwright test --list` sólo valida configuración y descubrimiento; no sustituye el E2E.

## Integración de base de datos

`pnpm test` no incluye integración. Usá una rama Neon descartable y variables explícitas; el gate debe equivaler a `ALLOW_DATABASE_TESTS=true`:

```powershell
$env:TEST_DATABASE_URL='<url-directa-rama-aislada>'
$env:ALLOW_DATABASE_TESTS='true'
pnpm test:integration
```

La suite verifica el journal `0000`–`0004`, perfiles, restricciones de rol y protección transaccional del último administrador. Nunca uses una URL de producción como `TEST_DATABASE_URL`.

## Evidencia antes de producción

- [ ] Unitarias, rutas API, typecheck e integración están verdes; no se ejecuta build por la regla del proyecto.
- [ ] E2E administrativo y TikTok están verdes sobre el preview migrado.
- [ ] Se revisaron `/admin` y las páginas públicas en móvil y escritorio.
- [ ] Se conservaron logs, capturas y referencia exacta de la rama/esquema verificado.
- [ ] Los usuarios de prueba fueron eliminados sólo después de guardar la evidencia.
