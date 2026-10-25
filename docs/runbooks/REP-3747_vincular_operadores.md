# REP-3747 · Vincular las cuentas de los operadores de prueba

Las direcciones `@reportalo.test` del seed v04 no reciben el magic link, así que no pueden iniciar sesión. Cada operador usa **una casilla real del equipo**, acordada entre Matías e Iván (una por organismo). Los mails **no se versionan**: se reemplazan solo al momento de correr esto.

## Pasos
1. Con la migración `rep3747_acceso_panel_operador` aplicada, cada casilla inicia sesión una vez en staging (Google o magic link). El trigger `on_auth_user_created` crea su fila en `profiles` con rol de ciudadano.
2. En el SQL Editor de staging, con la casilla real en lugar de `<correo>`:

```sql
-- Operador de Reportalo CABA (organismo de prueba)
update public.profiles
   set role = 'organismo',
       agency_id = (select id from public.agencies where code = 'reportalo_caba'),
       updated_at = now()
 where id = (select id from auth.users where email = '<correo CABA>');

-- Operador de Reportalo Avellaneda (organismo de prueba)
update public.profiles
   set role = 'organismo',
       agency_id = (select id from public.agencies where code = 'reportalo_avellaneda'),
       updated_at = now()
 where id = (select id from auth.users where email = '<correo Avellaneda>');
```

3. Verificar (tiene que devolver 2 filas, una por organismo):

```sql
select a.code, a.is_test, count(*) as operadores
  from public.profiles p join public.agencies a on a.id = p.agency_id
 where p.role = 'organismo' and a.is_test
 group by a.code, a.is_test;
```

4. Entrar a `/panel` con cada casilla: se ve «Panel de organismos» con el nombre del organismo de prueba. Una cuenta de ciudadano termina en `/acceso-restringido`.

## Para volver atrás
```sql
update public.profiles set role = 'ciudadano', agency_id = null, updated_at = now()
 where id = (select id from auth.users where email = '<correo>');
```

Si en el futuro hay más operadores, se vinculan igual. Los perfiles demo `oficial.caba` y `oficial.avellaneda` siguen vinculados, pero no pueden iniciar sesión.
