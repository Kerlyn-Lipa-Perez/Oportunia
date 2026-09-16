# Oportunia

Portal peruano de oportunidades con Next.js App Router, TypeScript y un CMS editorial propio. El catálogo inicial contiene **ejemplos demostrativos**, no convocatorias verificadas para postular.

## Inicio local

Requiere Node.js 24 o superior y pnpm. Desde esta carpeta:

```sh
pnpm install
```

Copiá `.env.example` a `.env.local` y configurá `EDITOR_EMAIL`, `EDITOR_PASSWORD` y `SESSION_SECRET` con valores privados. Para generar un secreto:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
pnpm dev
```

Abrí <http://localhost:3000>. El CMS está en `/admin`; las credenciales son las configuradas en `.env.local`. No compartas ese archivo ni uses las credenciales de ejemplo en producción.

## Qué incluye

- Catálogo con búsqueda y filtros, fichas por URL, fechas de cierre y acceso a la fuente oficial.
- CMS con autenticación, persistencia SQLite y operaciones editoriales; los vencimientos se calculan al consultar el catálogo.
- Guardados y preferencias de alertas en este navegador. **No se envían correos ni mensajes de WhatsApp**.
- API de eventos para vistas, guardados y clics oficiales con campos UTM. Los eventos se almacenan en SQLite; no incluye un panel analítico.
- Sitemap que excluye ejemplos y fichas no publicadas, imagen social de marca y bloqueo de rastreo en desarrollo. `robots.txt` no reemplaza la autenticación del CMS.

## Datos y despliegue

La base se crea al iniciar consultas en `data/oportunia.db`; `DATABASE_PATH` permite cambiar su ubicación. Usá un servidor Node.js con disco persistente y una sola instancia, y respaldá la base con herramientas compatibles con SQLite/WAL. Un filesystem efímero de funciones serverless no conserva estos datos.

Configurá `NEXT_PUBLIC_SITE_URL` con el origen público HTTPS antes del despliegue para los enlaces canónicos y sociales. El acceso editorial inicial corresponde a un editor configurado por entorno; la administración de múltiples editores y recuperación de contraseñas quedan pendientes.

Antes de abrir el portal al público, reemplazá las demostraciones por fichas revisadas contra fuentes oficiales, comprobá fechas y responsables, y definí el proceso editorial diario. Los espacios publicitarios están reservados: requieren una cuenta y aprobación de AdSense antes de insertar anuncios. El proyecto implementado no equivale a un catálogo listo para lanzamiento.

## Verificación

```sh
pnpm test
pnpm typecheck
```

Las pruebas comprueban reglas de dominio. Validá además en el navegador búsqueda, ficha, inicio de sesión y publicación editorial. No se ejecuta una compilación de producción como parte de este trabajo.
