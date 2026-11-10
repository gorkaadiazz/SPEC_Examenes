-- =============================================================================
-- Fase 6 · Límite diario de llamadas a la IA (sección 4.6 de SPEC.md)
--
-- La Edge Function `gemini` llama a esta función (con la service role) antes
-- de cada petición a Gemini. Suma 1 al contador de hoy del usuario y devuelve
-- cuántas lleva; si ya ha llegado al límite, no suma y devuelve NULL.
-- Es atómica: dos llamadas a la vez no pueden saltarse el límite.
-- =============================================================================

create or replace function public.sumar_uso_ia(p_user uuid, p_limite integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamadas integer;
begin
  if p_limite < 1 then
    return null;
  end if;
  insert into public.uso_ia (user_id, fecha, llamadas)
  values (p_user, current_date, 1)
  on conflict (user_id, fecha) do update
    set llamadas = public.uso_ia.llamadas + 1, updated_at = now()
    where public.uso_ia.llamadas < p_limite
  returning llamadas into v_llamadas;
  return v_llamadas; -- NULL si no se ha podido sumar (límite alcanzado)
end;
$$;

-- Solo la puede ejecutar el servidor (service role), nunca la app.
revoke all on function public.sumar_uso_ia(uuid, integer) from public, anon, authenticated;
grant execute on function public.sumar_uso_ia(uuid, integer) to service_role;
