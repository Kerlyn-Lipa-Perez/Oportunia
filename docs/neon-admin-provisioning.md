# Provisionar y administrar el equipo

El acceso al panel usa dos capas coordinadas: Neon Auth mantiene identidad, credenciales y sesiones; `app_profiles` decide qué puede hacer esa identidad en Oportunia. La promoción inicial siempre se valida en una rama aislada y llega a producción sólo después del E2E externo.

## Mapa de roles

| Oportunia | Neon Auth | Alcance |
|---|---|---|
| `admin` | `admin` | Contenido, campañas, ingesta, analítica y equipo. |
| `editor` | `user` | Contenido, campañas, ingesta y analítica; sin acceso a `/api/admin/users`. |

Una cuenta sin `app_profiles`, con perfil suspendido o con un rol desconocido no obtiene acceso editorial.

## Promoción segura de la cuenta raíz

1. Creá un snapshot recuperable de `production`.
2. Creá una rama aislada clonada de producción.
3. Verificá el esquema `0000`, baseliná `drizzle.__drizzle_migrations` y aplicá `0001`, `0002`, `0003` y `0004`, en ese orden.
4. Insertá o actualizá `app_profiles` como `admin` activo **antes** de cambiar el rol en Neon Auth. Así no existe una identidad privilegiada sin autorización válida en Oportunia.
5. Asigná el rol Neon Auth `admin` a la misma identidad.
6. Ejecutá integración y E2E contra esa rama realmente migrada.
7. Repetí el procedimiento en producción únicamente después de aprobar esas verificaciones.

El perfil inicial se crea con el `id` de la identidad existente, nunca con una cuenta duplicada:

```sql
insert into app_profiles (user_id, role, suspended, created_at, updated_at)
values ('<neon-auth-user-id>', 'admin', false, now()::text, now()::text)
on conflict (user_id) do update
set role = excluded.role,
    suspended = false,
    updated_at = excluded.updated_at;
```

Las contraseñas permanecen exclusivamente en Neon Auth. Las cuentas creadas desde “Equipo” exigen una contraseña inicial de al menos 12 caracteres; la aplicación no la persiste ni la registra.

## Operación desde “Equipo”

`GET`, `POST` y `PATCH /api/admin/users` requieren sesión activa, perfil Oportunia `admin` y origen válido. El panel permite listar, crear, cambiar rol, suspender y reactivar.

Las transiciones mantienen ambas capas sincronizadas:

- degradar un administrador actualiza primero `app_profiles`, revoca sus sesiones y luego asigna Neon `user`;
- suspender actualiza primero el perfil, bloquea la identidad en Neon Auth y revoca sus sesiones;
- reactivar desbloquea la identidad y luego habilita el perfil;
- el administrador no puede modificar ni suspender su propia cuenta;
- una validación de servicio y un trigger transaccional protegen al último administrador activo.

Esta versión no incluye borrado, suplantación, reset administrativo de contraseñas ni gestión manual de sesiones. Si una creación falla después de generar la identidad, la cuenta queda bloqueada y sin sesiones para cerrar el acceso de forma segura.

## Verificación mínima

- [ ] La cuenta raíz entra a `/admin` y conserva la sesión tras recargar.
- [ ] Puede crear una cuenta `editor` con contraseña de 12 o más caracteres.
- [ ] El editor usa operaciones editoriales y recibe `403` en `/api/admin/users`.
- [ ] Cambiar rol revoca sesiones y sincroniza Neon Auth.
- [ ] Suspender bloquea el acceso; reactivar lo restaura.
- [ ] Nadie puede modificar su propia cuenta ni desactivar al último administrador activo.
