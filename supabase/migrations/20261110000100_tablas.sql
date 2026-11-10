-- =============================================================================
-- Fase 3 · Tablas de la app (sección 6.2 de SPEC.md)
--
-- Columnas comunes de todas las tablas:
--   id          uuid generado en el cliente (permite crear registros sin conexión)
--   user_id     dueño de la fila; por defecto, el usuario de la sesión
--   created_at  cuándo se creó
--   updated_at  cuándo se modificó EN EL DISPOSITIVO (sirve para resolver
--               conflictos: gana el cambio más reciente)
--   sync_at     cuándo llegó el cambio AL SERVIDOR (hora del servidor). La app
--               lo usa para descargar solo lo nuevo desde la última vez.
--
-- Las claves foráneas son compuestas (id + user_id): así es imposible colgar
-- una fila tuya de una fila de otro usuario, aunque se conozca su id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funciones de los triggers
-- ---------------------------------------------------------------------------

-- Antes de insertar o actualizar:
--  * Si llega una versión MÁS ANTIGUA que la guardada, se ignora (gana el
--    updated_at más reciente, aunque dos dispositivos suban a la vez).
--  * Si el cliente no manda updated_at, se pone la hora actual.
--  * sync_at siempre es la hora del servidor.
--  * user_id no se puede cambiar.
create or replace function public.antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at is not null and new.updated_at < old.updated_at then
      return old; -- versión antigua: se queda la que había
    end if;
    if new.updated_at is null or new.updated_at = old.updated_at then
      new.updated_at := now();
    end if;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  elsif new.updated_at is null then
    new.updated_at := now();
  end if;
  new.sync_at := clock_timestamp();
  return new;
end;
$$;

-- Tabla de borrados: cuando se borra una fila, se apunta aquí para que los
-- otros dispositivos se enteren y la borren también de su copia local.
create table public.borrados (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tabla text not null,
  fila_id uuid not null,
  sync_at timestamptz not null default clock_timestamp()
);
create index borrados_user_sync_idx on public.borrados (user_id, sync_at);

-- Después de borrar: se apunta en `borrados`. Es SECURITY DEFINER porque el
-- usuario no tiene permiso para escribir directamente en `borrados`.
create or replace function public.despues_de_borrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.borrados (user_id, tabla, fila_id)
  values (old.user_id, tg_table_name, old.id);
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.perfiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default '',
  curso text not null default '2º SMR',
  centro text not null default 'IES Ribera del Tajo',
  limite_faltas numeric(5, 2) not null default 25 check (limite_faltas between 0 and 100),
  tema text not null default 'claro' check (tema in ('claro', 'oscuro', 'auto')),
  preferencias jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  check (id = user_id)
);

create table public.modulos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 120),
  abreviatura text not null check (length(abreviatura) between 1 and 6),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  profesor text not null default '',
  horas_semanales numeric(4, 1) check (horas_semanales between 0 and 40),
  sistema_notas text not null default 'ra' check (sistema_notas in ('ra', 'porcentajes')),
  orden integer not null default 0,
  imagen text,                                       -- clave de la ilustración
  foto text check (foto is null or (foto like 'data:image/jpeg;base64,%' and length(foto) < 200000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.resultados_aprendizaje (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid not null,
  codigo text not null check (length(codigo) between 1 and 8),
  descripcion text not null default '',
  peso numeric(5, 2) not null default 0 check (peso between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.evaluaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid not null,
  titulo text not null check (length(titulo) between 1 and 120),
  tipo text not null check (tipo in ('examen_teorico', 'examen_practico', 'practica', 'trabajo', 'exposicion', 'entrega', 'recuperacion')),
  fecha timestamptz not null,
  evaluacion text not null default '1' check (evaluacion in ('1', '2', 'final')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'entregado', 'aprobado', 'suspendido')),
  nota numeric(4, 2) check (nota between 0 and 10),
  notas text not null default '',
  enlace text check (enlace is null or enlace ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.evaluacion_ra (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  evaluacion_id uuid not null,
  ra_id uuid not null,
  peso numeric(5, 2) not null default 100 check (peso between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (evaluacion_id, user_id) references public.evaluaciones (id, user_id) on delete cascade,
  foreign key (ra_id, user_id) references public.resultados_aprendizaje (id, user_id) on delete cascade
);

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  evaluacion_id uuid not null,
  texto text not null check (length(texto) between 1 and 200),
  estudiado boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (evaluacion_id, user_id) references public.evaluaciones (id, user_id) on delete cascade
);

-- Apuntes (PDF o fotos). El contenido está en Storage, bucket `temarios`.
create table public.archivos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid,
  evaluacion_id uuid,
  ruta text,                                         -- {user_id}/... en Storage
  nombre text not null,
  tamano bigint not null check (tamano between 0 and 20971520),
  tipo text not null check (tipo in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  check (modulo_id is not null or evaluacion_id is not null),
  check (ruta is null or ruta like user_id::text || '/%'),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade,
  foreign key (evaluacion_id, user_id) references public.evaluaciones (id, user_id) on delete cascade
);

create table public.faltas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid not null,
  fecha date not null,
  horas numeric(4, 1) not null default 1 check (horas > 0 and horas <= 12),
  justificada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.fe_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null,
  horas numeric(4, 1) not null check (horas > 0 and horas <= 24),
  tareas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now()
);

create table public.examenes_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid not null,
  temas jsonb not null default '[]'::jsonb,
  preguntas jsonb not null default '[]'::jsonb,
  respuestas jsonb not null default '[]'::jsonb,
  nota numeric(4, 2) check (nota between 0 and 10),
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid not null,
  pregunta text not null,
  respuesta text not null,
  nivel integer not null default 0 check (nivel between 0 and 10),
  proxima_revision date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.pomodoro_sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  modulo_id uuid,
  inicio timestamptz not null,
  minutos integer not null check (minutos between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  foreign key (modulo_id, user_id) references public.modulos (id, user_id) on delete cascade
);

create table public.chuletas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categoria text not null,
  comando text not null,
  descripcion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now()
);

-- Límite diario de llamadas a la IA. Solo la escribe la Edge Function.
create table public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  llamadas integer not null default 0 check (llamadas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_at timestamptz not null default now(),
  unique (user_id, fecha)
);

-- ---------------------------------------------------------------------------
-- Triggers e índices para todas las tablas de datos
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles', 'modulos', 'resultados_aprendizaje', 'evaluaciones', 'evaluacion_ra',
    'temas', 'archivos', 'faltas', 'fe_registros', 'examenes_ia', 'flashcards',
    'pomodoro_sesiones', 'chuletas', 'uso_ia'
  ]
  loop
    execute format('create trigger antes_de_guardar before insert or update on public.%I
                    for each row execute function public.antes_de_guardar()', t);
    execute format('create trigger despues_de_borrar after delete on public.%I
                    for each row execute function public.despues_de_borrar()', t);
    -- Para "dame lo mío que haya cambiado desde X"
    execute format('create index %I on public.%I (user_id, sync_at)', t || '_user_sync_idx', t);
  end loop;
end;
$$;

-- Índices de las claves foráneas y de las fechas más consultadas
create index resultados_aprendizaje_modulo_idx on public.resultados_aprendizaje (modulo_id);
create index evaluaciones_modulo_idx on public.evaluaciones (modulo_id);
create index evaluaciones_user_fecha_idx on public.evaluaciones (user_id, fecha);
create index evaluacion_ra_evaluacion_idx on public.evaluacion_ra (evaluacion_id);
create index evaluacion_ra_ra_idx on public.evaluacion_ra (ra_id);
create index temas_evaluacion_idx on public.temas (evaluacion_id);
create index archivos_modulo_idx on public.archivos (modulo_id);
create index archivos_evaluacion_idx on public.archivos (evaluacion_id);
create index faltas_modulo_idx on public.faltas (modulo_id);
create index faltas_user_fecha_idx on public.faltas (user_id, fecha);
create index fe_registros_user_fecha_idx on public.fe_registros (user_id, fecha);
create index examenes_ia_modulo_idx on public.examenes_ia (modulo_id);
create index flashcards_modulo_idx on public.flashcards (modulo_id);
create index flashcards_user_revision_idx on public.flashcards (user_id, proxima_revision);
create index pomodoro_sesiones_modulo_idx on public.pomodoro_sesiones (modulo_id);
create index pomodoro_sesiones_user_inicio_idx on public.pomodoro_sesiones (user_id, inicio);
