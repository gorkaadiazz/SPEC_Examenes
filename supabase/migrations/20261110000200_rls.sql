-- =============================================================================
-- Fase 3 · Row Level Security (sección 6.3 de SPEC.md)
--
-- RLS activado en TODAS las tablas, sin excepción. Para el rol `authenticated`
-- hay cuatro políticas por tabla (select, insert, update, delete) que solo
-- dejan tocar las filas propias. Para `anon` no hay ninguna política: sin
-- sesión no se ve nada.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles', 'modulos', 'resultados_aprendizaje', 'evaluaciones', 'evaluacion_ra',
    'temas', 'archivos', 'faltas', 'fe_registros', 'examenes_ia', 'flashcards',
    'pomodoro_sesiones', 'chuletas'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('create policy "solo_mis_filas_select" on public.%I
      for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "solo_mis_filas_insert" on public.%I
      for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "solo_mis_filas_update" on public.%I
      for update to authenticated using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "solo_mis_filas_delete" on public.%I
      for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- uso_ia: el usuario solo puede LEER su contador. Lo escribe la Edge Function
-- `gemini` con la service role (que se salta RLS).
alter table public.uso_ia enable row level security;
create policy "solo_mis_filas_select" on public.uso_ia
  for select to authenticated using ((select auth.uid()) = user_id);

-- borrados: solo lectura de lo propio. Lo rellena el trigger despues_de_borrar.
alter table public.borrados enable row level security;
create policy "solo_mis_filas_select" on public.borrados
  for select to authenticated using ((select auth.uid()) = user_id);

-- Por si acaso: anon no tiene ningún permiso sobre estas tablas.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.uso_ia, public.borrados from authenticated;
