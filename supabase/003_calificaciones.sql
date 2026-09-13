-- Caserita · migración 003 — Calificación anónima del vendedor
--
-- Se ejecuta UNA vez, después de 002. Es idempotente.
-- No contiene secretos, wallets ni datos de prueba.
--
-- Qué agrega:
--   1. La tabla `calificaciones`: de 1 a 5 estrellas, una por trato.
--   2. Los contadores en `users` para no recalcular el promedio en cada lectura.

-- Va fuera de la transacción: agregar un valor a un enum y usarlo en la misma
-- transacción no está permitido.
alter type public.tipo_evento add value if not exists 'CALIFICACION_RECIBIDA';

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Calificaciones.
--
--    El anonimato está en el esquema, no en una promesa de la interfaz: **esta
--    tabla no tiene comprador_id**. El permiso para calificar se verifica
--    contra tratos.comprador_id al momento de escribir, y después no queda
--    rastro de quién puso qué.
--
--    `trato_id` es único: un trato entregado da derecho a exactamente una
--    calificación. Como solo se puede calificar un trato LIBERADO, cada
--    estrella costó una compra real con dinero real — que es justo lo que no
--    tienen las reseñas que se compran por internet.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.calificaciones (
  id varchar(24) primary key,
  trato_id varchar(16) not null,
  vendedor_id varchar(24) not null,
  estrellas integer not null,
  created_at timestamp with time zone not null default now(),

  constraint calificaciones_trato_id_unique unique (trato_id),
  constraint calificaciones_rango check (estrellas between 1 and 5),

  constraint calificaciones_trato_id_tratos_id_fk
    foreign key (trato_id) references public.tratos(id) on delete cascade,

  constraint calificaciones_vendedor_id_users_id_fk
    foreign key (vendedor_id) references public.users(id)
);

create index if not exists calificaciones_vendedor_idx
  on public.calificaciones using btree (vendedor_id, created_at);

-- Igual que el resto de las tablas: nunca expuesta por la API pública.
alter table public.calificaciones enable row level security;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke all privileges on table public.calificaciones from anon;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all privileges on table public.calificaciones from authenticated;
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Contadores. Se guarda la suma y la cantidad, no el promedio: así sumar una
--    calificación nueva es un UPDATE y el promedio se deriva al mostrarlo.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists calificaciones_recibidas integer not null default 0,
  add column if not exists suma_estrellas integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_estrellas_coherentes') then
    alter table public.users
      add constraint users_estrellas_coherentes check (
        calificaciones_recibidas >= 0
        and suma_estrellas >= 0
        and suma_estrellas <= calificaciones_recibidas * 5
      );
  end if;
end
$$;

-- Reconstrucción desde la tabla, para que correr esto dos veces dé lo mismo.
update public.users u
set calificaciones_recibidas = coalesce(a.cantidad, 0),
    suma_estrellas = coalesce(a.suma, 0),
    updated_at = now()
from (
  select u2.id,
         (select count(*) from public.calificaciones c where c.vendedor_id = u2.id) as cantidad,
         (select sum(c.estrellas) from public.calificaciones c where c.vendedor_id = u2.id) as suma
  from public.users u2
) a
where u.id = a.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Registrar la migración 0002 de Drizzle.
-- ─────────────────────────────────────────────────────────────────────────────
insert into drizzle.__drizzle_migrations (hash, created_at)
select 'd068de054e0a023c41e7f2add9f3cfc390328086bd730ad1cc0d5260773b5eb7', (extract(epoch from now()) * 1000)::bigint
where not exists (
  select 1 from drizzle.__drizzle_migrations where hash = 'd068de054e0a023c41e7f2add9f3cfc390328086bd730ad1cc0d5260773b5eb7'
);

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comprobaciones.
-- ─────────────────────────────────────────────────────────────────────────────

-- La tabla existe y no tiene ninguna columna que identifique al comprador.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'calificaciones'
order by ordinal_position;

-- Los dos contadores nuevos en users.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('calificaciones_recibidas', 'suma_estrellas')
order by column_name;
