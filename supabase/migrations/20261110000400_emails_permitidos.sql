-- =============================================================================
-- Fase 3 · Solo pueden entrar los emails de la lista (sección 6.1 de SPEC.md)
--
-- La app es personal: así nadie más gasta tu cuota de Supabase ni de Gemini.
-- Si alguien intenta registrarse con un email que no está en la lista, el
-- registro falla y la app muestra "Este email no tiene acceso".
--
-- Para añadir tu email (una sola vez, desde el SQL Editor de Supabase):
--   insert into public.emails_permitidos (email) values ('tu.email@gmail.com');
-- =============================================================================

create table public.emails_permitidos (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- RLS activado y SIN políticas: desde la app nadie puede leerla ni tocarla.
alter table public.emails_permitidos enable row level security;
revoke all on public.emails_permitidos from anon, authenticated;

create or replace function public.comprobar_email_permitido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.emails_permitidos where email = lower(new.email)
  ) then
    raise exception 'Este email no tiene acceso a la app'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Se comprueba al crear el usuario (primer inicio de sesión con Google).
create trigger comprobar_email_permitido
  before insert on auth.users
  for each row execute function public.comprobar_email_permitido();
