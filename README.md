# Oportunia

Portal peruano de oportunidades con Next.js App Router, TypeScript, Neon Postgres y Neon Managed Auth. El catálogo inicial contiene **ejemplos demostrativos**, no convocatorias verificadas para postular.

## Inicio local

Requiere Node.js 24 o superior y pnpm. Desde esta carpeta:

```sh
pnpm install
```

Copiá `.env.example` a `.env.local`, configurá `DATABASE_URL` y ejecutá `neon env pull` después de habilitar Neon Auth. Luego generá `NEON_AUTH_COOKIE_SECRET` (mínimo 32 caracteres):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
pnpm dev
```

Abrí <http://localhost:3000>. El CMS está en `/admin` y usa Neon Managed Auth. No compartas `.env.local` ni sus secretos.

## Qué incluye

- Catálogo con búsqueda y filtros, fichas por URL, fechas de cierre y acceso a la fuente oficial.
- CMS con identidad de Neon Managed Auth, roles de aplicación en Postgres y operaciones editoriales; los vencimientos se calculan al consultar el catálogo.
- Guardados y preferencias de alertas en este navegador. **No se envían correos ni mensajes de WhatsApp**.
- API de eventos para vistas, guardados y clics oficiales con campos UTM. Los eventos se almacenan en SQLite; no incluye un panel analítico.
- Sitemap que excluye ejemplos y fichas no publicadas, imagen social de marca y bloqueo de rastreo en desarrollo. `robots.txt` no reemplaza la autenticación del CMS.

## Datos y despliegue

Configurá `DATABASE_URL` con la cadena de conexión de Neon Postgres. Las oportunidades y los roles de aplicación se conservan en Postgres; no dependas de un filesystem local para los datos.

Configurá `NEXT_PUBLIC_SITE_URL` con el origen público HTTPS antes del despliegue para los enlaces canónicos y sociales. Añadí el origen en los dominios confiables de Neon Auth. La identidad se administra en Neon Auth y los permisos editoriales en `app_profiles`.

Antes de abrir el portal al público, reemplazá las demostraciones por fichas revisadas contra fuentes oficiales, comprobá fechas y responsables, y definí el proceso editorial diario. Los espacios publicitarios están reservados: requieren una cuenta y aprobación de AdSense antes de insertar anuncios. El proyecto implementado no equivale a un catálogo listo para lanzamiento.

## Verificación

```sh
pnpm test
pnpm typecheck
```

Las pruebas comprueban reglas de dominio. Validá además en el navegador búsqueda, ficha, inicio de sesión y publicación editorial. No se ejecuta una compilación de producción como parte de este trabajo.
