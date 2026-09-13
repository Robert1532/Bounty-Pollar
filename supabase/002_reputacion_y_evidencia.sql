-- Caserita · migración 002 — Reputación y evidencia de entrega
--
-- Se ejecuta UNA vez sobre una base que ya tiene el esquema inicial (001).
-- Es idempotente: correrla dos veces no rompe nada ni duplica contadores.
-- No contiene secretos, wallets ni datos de prueba.
--
-- Qué agrega:
--   1. Contadores de reputación en users (tratos cumplidos y devueltos).
--   2. Columnas de evidencia de entrega en tratos (foto opcional).
--   3. El bucket privado de Storage donde vive esa foto.
--   4. El backfill de los contadores con los tratos que ya están cerrados.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Nuevo tipo de evento. Va fuera de la transacción a propósito: agregar un
--    valor a un enum y usarlo en la misma transacción no está permitido.
-- ─────────────────────────────────────────────────────────────────────────────
alter type public.tipo_evento add value if not exists 'EVIDENCIA_ADJUNTADA';

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reputación.
--
--    No son estrellas ni reseñas: son hechos que ya ocurrieron y quedaron en la
--    red. Se guardan como contadores porque la página pública del trato los
--    muestra antes de que el comprador pague. La fuente de verdad sigue siendo
--    la tabla tratos — el bloque 5 los reconstruye desde cero.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists ventas_completadas integer not null default 0,
  add column if not exists compras_completadas integer not null default 0,
  add column if not exists devoluciones_como_vendedor integer not null default 0,
  add column if not exists devoluciones_como_comprador integer not null default 0,
  add column if not exists volumen_vendido_usdc numeric(20, 7) not null default 0,
  add column if not exists primer_trato_en timestamp with time zone;

-- Un contador negativo solo puede venir de un error de código; que la base lo
-- rechace evita que un número imposible llegue a la pantalla de un comprador.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_contadores_no_negativos'
  ) then
    alter table public.users
      add constraint users_contadores_no_negativos check (
        ventas_completadas >= 0
        and compras_completadas >= 0
        and devoluciones_como_vendedor >= 0
        and devoluciones_como_comprador >= 0
        and volumen_vendido_usdc >= 0
      );
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Evidencia de entrega.
--
--    Foto opcional que el vendedor adjunta al entregar. No condiciona la
--    liberación del pago; deja un registro con hora y hash que ninguna de las
--    dos partes puede cambiar después. La base guarda la ruta dentro del bucket
--    privado, nunca los bytes ni una URL pública.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.tratos
  add column if not exists evidencia_ruta varchar(200),
  add column if not exists evidencia_tipo varchar(40),
  add column if not exists evidencia_bytes integer,
  add column if not exists evidencia_hash varchar(64),
  add column if not exists evidencia_subida_en timestamp with time zone;

-- Índice parcial: solo indexa los tratos que sí tienen foto.
create index if not exists tratos_evidencia_idx
  on public.tratos (evidencia_subida_en)
  where evidencia_ruta is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill: los tratos que ya están cerrados también cuentan.
--
--    Se recalcula todo desde cero en vez de sumar, así correr este script dos
--    veces deja exactamente el mismo resultado.
-- ─────────────────────────────────────────────────────────────────────────────
with cerrados as (
  select vendedor_id, comprador_id, estado, monto_usdc, cerrado_en
  from public.tratos
  where estado in ('LIBERADO', 'DEVUELTO')
),
agregados as (
  select
    u.id,
    coalesce((select count(*) from cerrados c where c.vendedor_id = u.id and c.estado = 'LIBERADO'), 0) as ventas,
    coalesce((select count(*) from cerrados c where c.comprador_id = u.id and c.estado = 'LIBERADO'), 0) as compras,
    coalesce((select count(*) from cerrados c where c.vendedor_id = u.id and c.estado = 'DEVUELTO'), 0) as dev_vend,
    coalesce((select count(*) from cerrados c where c.comprador_id = u.id and c.estado = 'DEVUELTO'), 0) as dev_comp,
    coalesce((select sum(c.monto_usdc) from cerrados c where c.vendedor_id = u.id and c.estado = 'LIBERADO'), 0) as volumen,
    (select min(c.cerrado_en) from cerrados c where c.vendedor_id = u.id or c.comprador_id = u.id) as primero
  from public.users u
)
update public.users u
set ventas_completadas = a.ventas,
    compras_completadas = a.compras,
    devoluciones_como_vendedor = a.dev_vend,
    devoluciones_como_comprador = a.dev_comp,
    volumen_vendido_usdc = a.volumen,
    primer_trato_en = a.primero,
    updated_at = now()
from agregados a
where u.id = a.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Registrar la migración 0001 de Drizzle, para que 'drizzle-kit migrate' no
--    intente aplicarla otra vez sobre una base que ya la tiene.
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists drizzle;

create table if not exists drizzle.__drizzle_migrations (
  id serial primary key,
  hash text not null,
  created_at bigint
);

insert into drizzle.__drizzle_migrations (hash, created_at)
select '7d1111a650b9dc2f827344942b24212610895b7edab2e8eaf03b86e18d603b63', (extract(epoch from now()) * 1000)::bigint
where not exists (
  select 1 from drizzle.__drizzle_migrations where hash = '7d1111a650b9dc2f827344942b24212610895b7edab2e8eaf03b86e18d603b63'
);

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Bucket de Storage para las fotos de entrega.
--
--    PRIVADO. La app lo escribe con la service role key desde el servidor y
--    entrega URLs firmadas que caducan a los 5 minutos; sin políticas para
--    'anon' ni 'authenticated', nadie puede leerlo directamente.
--
--    Si tu proyecto no expone el esquema storage desde el SQL Editor, crea el
--    bucket a mano en Storage → New bucket, nombre "evidencias", Public = OFF.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('evidencias', 'evidencias', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = false,
          file_size_limit = 5242880,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comprobaciones. Deben devolver filas.
-- ─────────────────────────────────────────────────────────────────────────────

-- 6 columnas nuevas en users + 5 en tratos.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'users' and column_name in (
      'ventas_completadas', 'compras_completadas', 'devoluciones_como_vendedor',
      'devoluciones_como_comprador', 'volumen_vendido_usdc', 'primer_trato_en'))
    or
    (table_name = 'tratos' and column_name in (
      'evidencia_ruta', 'evidencia_tipo', 'evidencia_bytes',
      'evidencia_hash', 'evidencia_subida_en'))
  )
order by table_name, column_name;

-- El bucket tiene que existir y tener public = false.
select id, public, file_size_limit
from storage.buckets
where id = 'evidencias';
