# Provisionar un administrador de Neon Auth

1. Habilitá Neon Auth y registrá el origen de la aplicación como dominio confiable.
2. Creá la cuenta mediante el formulario de inicio de sesión de `/admin` o el flujo administrado de Neon Auth. Nunca copies contraseñas a archivos del proyecto.
3. En Neon SQL Editor, sustituí el marcador por el `id` de esa cuenta y ejecutá:

```sql
insert into app_profiles (user_id, role, created_at, updated_at)
values ('<replace-with-neon-auth-user-id>', 'admin', now()::text, now()::text)
on conflict (user_id) do update
set role = excluded.role, updated_at = excluded.updated_at;
```

El rol queda separado de las identidades, sesiones y contraseñas gestionadas por Neon Auth. No se provisiona ningún usuario automáticamente desde la aplicación.
