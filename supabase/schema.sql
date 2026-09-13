-- Caserita - esquema inicial para Supabase/PostgreSQL
-- Ejecutar UNA sola vez en un proyecto Supabase nuevo desde SQL Editor.
-- No contiene secretos, wallets ni datos de prueba.

begin;

-- Fallar de forma segura si ya existe alguna tabla de Caserita. Así evitamos
-- aceptar silenciosamente un esquema parcial o distinto.
do $$
begin
  if to_regclass('public.users') is not null
     or to_regclass('public.tratos') is not null
     or to_regclass('public.eventos') is not null
     or to_regclass('public.auth_nonces') is not null then
    raise exception 'El esquema de Caserita ya existe. No vuelvas a ejecutar esta migración.';
  end if;
end
$$;

create type public.estado_trato as enum (
  'BORRADOR',
  'PUBLICADO',
  'FINANCIADO',
  'LIBERANDO',
  'LIBERADO',
  'DEVOLVIENDO',
  'DEVUELTO',
  'EXPIRADO',
  'CANCELADO'
);

-- ACORDADA se conserva por compatibilidad con el esquema versionado, aunque
-- la v1 solo permite devoluciones por PLAZO_VENCIDO.
create type public.motivo_devolucion as enum (
  'PLAZO_VENCIDO',
  'ACORDADA'
);

create type public.tipo_evento as enum (
  'TRATO_CREADO',
  'DEPOSITO_DETECTADO',
  'DEPOSITO_RECHAZADO',
  'CODIGO_INTENTO_FALLIDO',
  'CODIGO_BLOQUEADO',
  'LIBERACION_INICIADA',
  'LIBERACION_COMPLETADA',
  'LIBERACION_FALLIDA',
  'DEVOLUCION_INICIADA',
  'DEVOLUCION_COMPLETADA',
  'DEVOLUCION_FALLIDA',
  'TRATO_CANCELADO',
  'TRATO_EXPIRADO',
  'WEBHOOK_RECIBIDO'
);

create table public.users (
  id varchar(24) primary key,
  wallet_address varchar(56) not null,
  pollar_user_id varchar(64),
  nombre varchar(80),
  telefono varchar(20),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_wallet_address_unique unique (wallet_address)
);

create table public.tratos (
  id varchar(16) primary key,
  vendedor_id varchar(24) not null,
  comprador_id varchar(24),
  titulo varchar(80) not null,
  descripcion varchar(500),
  lugar_entrega varchar(120),
  monto_usdc numeric(20, 7) not null,
  monto_bs_referencia numeric(20, 2),
  tipo_cambio_bs numeric(10, 4),
  estado public.estado_trato not null default 'PUBLICADO',
  codigo_hash varchar(80) not null,
  codigo_cifrado varchar(200) not null,
  codigo_intentos integer not null default 0,
  codigo_bloqueado boolean not null default false,
  escrow_address varchar(56) not null,
  memo varchar(28) not null,
  comprador_address varchar(56),
  vendedor_address varchar(56) not null,
  tx_deposito varchar(64),
  tx_liberacion varchar(64),
  tx_devolucion varchar(64),
  motivo_devolucion public.motivo_devolucion,
  expira_en timestamp with time zone not null,
  financiado_en timestamp with time zone,
  libera_hasta timestamp with time zone,
  cerrado_en timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint tratos_vendedor_id_users_id_fk
    foreign key (vendedor_id) references public.users(id),
  constraint tratos_comprador_id_users_id_fk
    foreign key (comprador_id) references public.users(id),
  constraint tratos_memo_unique unique (memo),
  constraint tratos_tx_deposito_unique unique (tx_deposito),
  constraint tratos_tx_liberacion_unique unique (tx_liberacion),
  constraint tratos_tx_devolucion_unique unique (tx_devolucion)
);

create table public.eventos (
  id varchar(24) primary key,
  trato_id varchar(16) not null,
  tipo public.tipo_evento not null,
  payload jsonb not null default '{}'::jsonb,
  actor_addr varchar(56),
  ip varchar(64),
  created_at timestamp with time zone not null default now(),
  constraint eventos_trato_id_tratos_id_fk
    foreign key (trato_id) references public.tratos(id) on delete cascade
);

create table public.auth_nonces (
  nonce varchar(64) primary key,
  usado_en timestamp with time zone,
  expira_en timestamp with time zone not null,
  created_at timestamp with time zone not null default now()
);

create index auth_nonces_expira_idx
  on public.auth_nonces using btree (expira_en);
create index eventos_trato_idx
  on public.eventos using btree (trato_id, created_at);
create index tratos_vendedor_idx
  on public.tratos using btree (vendedor_id, created_at);
create index tratos_comprador_idx
  on public.tratos using btree (comprador_id, created_at);
create index tratos_vencimiento_idx
  on public.tratos using btree (estado, libera_hasta);
create index tratos_expiracion_idx
  on public.tratos using btree (estado, expira_en);

-- Las tablas están en public porque Drizzle las espera allí, pero no deben
-- quedar expuestas mediante la API pública de Supabase. El backend de Caserita
-- usa la conexión PostgreSQL del servidor y no el cliente Supabase del browser.
alter table public.users enable row level security;
alter table public.tratos enable row level security;
alter table public.eventos enable row level security;
alter table public.auth_nonces enable row level security;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke all privileges on table public.users from anon;
    revoke all privileges on table public.tratos from anon;
    revoke all privileges on table public.eventos from anon;
    revoke all privileges on table public.auth_nonces from anon;
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all privileges on table public.users from authenticated;
    revoke all privileges on table public.tratos from authenticated;
    revoke all privileges on table public.eventos from authenticated;
    revoke all privileges on table public.auth_nonces from authenticated;
  end if;
end
$$;

-- Registrar la migración inicial para que `npm run db:migrate` pueda aplicar
-- correctamente las migraciones futuras sin intentar crear todo otra vez.
create schema if not exists drizzle;
create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

insert into drizzle.__drizzle_migrations (hash, created_at)
values (
  '65917b2b61863014e9a892a39728c4b739cdae7b399ee1636e9b7ac6c3ffca10',
  1789180883693
);

commit;

-- Verificación: deben aparecer 4 tablas, todas con rowsecurity = true.
select schemaname, tablename, rowsecurity
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename in ('users', 'tratos', 'eventos', 'auth_nonces')
order by tablename;

-- Verificación: debe devolver una fila con el hash de la migración inicial.
select id, hash, created_at
from drizzle.__drizzle_migrations
order by created_at;
