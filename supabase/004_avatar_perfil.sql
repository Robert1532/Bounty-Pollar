-- Caserita · migración 004 — foto de perfil privada
-- Idempotente. Se puede ejecutar otra vez sin duplicar columnas.

begin;

alter table public.users
  add column if not exists avatar_ruta varchar(200),
  add column if not exists avatar_tipo varchar(40),
  add column if not exists avatar_actualizado_en timestamp with time zone;

insert into drizzle.__drizzle_migrations (hash, created_at)
select '00da5cbdf86d48900e76483a37e59f8cacb8423f4cbbeb35cdf8ff073a2c83ef',
       (extract(epoch from now()) * 1000)::bigint
where not exists (
  select 1
  from drizzle.__drizzle_migrations
  where hash = '00da5cbdf86d48900e76483a37e59f8cacb8423f4cbbeb35cdf8ff073a2c83ef'
);

commit;
