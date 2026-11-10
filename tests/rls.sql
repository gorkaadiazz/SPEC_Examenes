-- =============================================================================
-- Test de RLS (sección 6.3 de SPEC.md)
--
-- Comprueba con dos usuarios de prueba (A y B) que ninguno puede leer, editar
-- ni borrar las filas del otro, que sin sesión no se ve nada y que nadie puede
-- colgar filas suyas de filas ajenas.
--
-- Cómo ejecutarlo (no deja nada guardado: todo va en una transacción que se
-- deshace al final):
--   · En Supabase: SQL Editor → pega este archivo → Run.
--   · Con psql:    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/rls.sql
-- Si todo va bien termina con:  NOTICE:  RLS OK: N comprobaciones superadas
-- Si algo falla se detiene con:  ERROR:  RLS FALLA: <qué ha fallado>
-- =============================================================================

begin;

create temporary table resultados (n int not null default 0);
insert into resultados values (0);
grant all on resultados to authenticated, anon, service_role;

-- Usuarios de prueba (sus emails tienen que estar permitidos)
insert into public.emails_permitidos (email) values ('prueba-a@rls.test'), ('prueba-b@rls.test');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'prueba-a@rls.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'prueba-b@rls.test');

-- Un email que no está en la lista no puede registrarse
do $$
begin
  insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000003', 'intruso@rls.test');
  raise exception 'RLS FALLA: se ha registrado un email que no está en emails_permitidos';
exception when insufficient_privilege then
  update resultados set n = n + 1;
end;
$$;

-- Ayudas: actuar como un usuario (o sin sesión) y comprobar
create or replace function pg_temp.como(usuario text) returns void language plpgsql as $$
begin
  if usuario = 'service' then
    perform set_config('role', 'service_role', true);
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  elsif usuario = 'anon' then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims',
      json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
  end if;
end;
$$;

create or replace function pg_temp.comprobar(condicion boolean, que text) returns void language plpgsql as $$
begin
  if not condicion then
    raise exception 'RLS FALLA: %', que;
  end if;
  update resultados set n = n + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- A crea sus datos
-- ---------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.modulos (id, nombre, abreviatura) values ('a0000000-0000-4000-8000-0000000000a1', 'SOR de A', 'SOR');
insert into public.evaluaciones (id, modulo_id, titulo, tipo, fecha)
  values ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-0000000000a1', 'Examen de A', 'examen_teorico', now() + interval '1 day');
insert into public.temas (evaluacion_id, texto) values ('a0000000-0000-4000-8000-0000000000e1', 'DHCP');
select pg_temp.comprobar((select count(*) from public.modulos) = 1, 'A no ve su propio módulo');
select pg_temp.comprobar((select user_id from public.modulos) = 'aaaaaaaa-0000-4000-8000-000000000001', 'user_id no se rellena con auth.uid()');

-- A no puede crear filas a nombre de B
do $$
begin
  insert into public.modulos (nombre, abreviatura, user_id) values ('Falso', 'X', 'bbbbbbbb-0000-4000-8000-000000000002');
  perform pg_temp.comprobar(false, 'A ha podido crear una fila con el user_id de B');
exception when insufficient_privilege then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- B intenta tocar lo de A
-- ---------------------------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.comprobar((select count(*) from public.modulos) = 0, 'B puede LEER los módulos de A');
select pg_temp.comprobar((select count(*) from public.evaluaciones) = 0, 'B puede LEER las evaluaciones de A');
select pg_temp.comprobar((select count(*) from public.temas) = 0, 'B puede LEER los temas de A');

with cambiadas as (
  update public.modulos set nombre = 'hackeado' where id = 'a0000000-0000-4000-8000-0000000000a1' returning 1
)
select pg_temp.comprobar((select count(*) from cambiadas) = 0, 'B puede EDITAR un módulo de A');

with borradas as (
  delete from public.evaluaciones where id = 'a0000000-0000-4000-8000-0000000000e1' returning 1
)
select pg_temp.comprobar((select count(*) from borradas) = 0, 'B puede BORRAR una evaluación de A');

-- B no puede colgar un tema suyo de la evaluación de A (clave foránea compuesta)
do $$
begin
  insert into public.temas (evaluacion_id, texto) values ('a0000000-0000-4000-8000-0000000000e1', 'intruso');
  perform pg_temp.comprobar(false, 'B ha podido colgar un tema de una evaluación de A');
exception when foreign_key_violation then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- B no puede escribir en uso_ia (solo lectura) ni en borrados
do $$
begin
  insert into public.uso_ia (fecha, llamadas) values (current_date, 0);
  perform pg_temp.comprobar(false, 'B puede escribir en uso_ia');
exception when insufficient_privilege then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- B no puede llamar a la función que suma el uso de la IA (solo el servidor)
do $$
begin
  perform public.sumar_uso_ia('bbbbbbbb-0000-4000-8000-000000000002', 20);
  perform pg_temp.comprobar(false, 'B puede ejecutar sumar_uso_ia');
exception when insufficient_privilege then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- B no puede leer la lista de emails permitidos
do $$
begin
  perform count(*) from public.emails_permitidos;
  perform pg_temp.comprobar(false, 'B puede leer emails_permitidos');
exception when insufficient_privilege then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sin sesión (anon) no se ve nada
-- ---------------------------------------------------------------------------
select pg_temp.como('anon');
do $$
begin
  perform count(*) from public.modulos;
  perform pg_temp.comprobar(false, 'anon puede leer modulos');
exception when insufficient_privilege then
  perform pg_temp.comprobar(true, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- A comprueba que sus datos siguen intactos
-- ---------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.comprobar((select nombre from public.modulos where id = 'a0000000-0000-4000-8000-0000000000a1') = 'SOR de A', 'el módulo de A ha cambiado');
select pg_temp.comprobar((select count(*) from public.evaluaciones) = 1, 'la evaluación de A ha desaparecido');

-- Gana el cambio más reciente: una versión antigua no pisa a una nueva
update public.modulos set nombre = 'nuevo', updated_at = now() + interval '1 hour' where id = 'a0000000-0000-4000-8000-0000000000a1';
update public.modulos set nombre = 'viejo', updated_at = now() - interval '1 hour' where id = 'a0000000-0000-4000-8000-0000000000a1';
select pg_temp.comprobar((select nombre from public.modulos where id = 'a0000000-0000-4000-8000-0000000000a1') = 'nuevo', 'una versión antigua ha pisado a una nueva');

-- Al borrar, queda apuntado en `borrados` (para los otros dispositivos), también en cascada
delete from public.modulos where id = 'a0000000-0000-4000-8000-0000000000a1';
select pg_temp.comprobar((select count(*) from public.borrados where tabla in ('modulos', 'evaluaciones', 'temas')) = 3, 'los borrados (en cascada) no quedan apuntados');
select pg_temp.como('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.comprobar((select count(*) from public.borrados) = 0, 'B puede ver los borrados de A');

-- El límite diario de la IA: suma hasta el tope y después devuelve NULL
select pg_temp.como('service');
select pg_temp.comprobar(public.sumar_uso_ia('aaaaaaaa-0000-4000-8000-000000000001', 2) = 1, 'sumar_uso_ia: primera llamada');
select pg_temp.comprobar(public.sumar_uso_ia('aaaaaaaa-0000-4000-8000-000000000001', 2) = 2, 'sumar_uso_ia: segunda llamada');
select pg_temp.comprobar(public.sumar_uso_ia('aaaaaaaa-0000-4000-8000-000000000001', 2) is null, 'sumar_uso_ia: no respeta el límite');
select pg_temp.como('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.comprobar((select llamadas from public.uso_ia) = 2, 'A no puede leer su contador de uso_ia');

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------
do $$
begin
  raise notice 'RLS OK: % comprobaciones superadas', (select n from resultados);
end;
$$;

rollback;
