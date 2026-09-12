import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Conexion a Postgres, inicializada de forma perezosa.
 *
 * Perezosa a proposito: durante `next build` los modulos de las rutas se
 * importan sin que exista DATABASE_URL, y abrir el pool ahi haria fallar el
 * build por una variable que recien hace falta en la primera consulta real.
 *
 * `prepare: false` es obligatorio detras de un pooler en modo transaccion
 * (Supabase pgBouncer, Neon pooler): con sentencias preparadas la conexion se
 * rompe apenas el pooler la recicla. El pool chico es por serverless: muchas
 * instancias, pocas conexiones cada una.
 */
type Db = PostgresJsDatabase<typeof schema>;

const global_ = globalThis as unknown as {
  __caseritaSql?: ReturnType<typeof postgres>;
  __caseritaDb?: Db;
};

export function getSql(): ReturnType<typeof postgres> {
  if (global_.__caseritaSql) return global_.__caseritaSql;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurado');

  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  global_.__caseritaSql = sql;
  return sql;
}

export function getDb(): Db {
  global_.__caseritaDb ??= drizzle(getSql(), { schema, casing: 'snake_case' });
  return global_.__caseritaDb;
}

/** Fachada perezosa: `db.select()` conecta recien cuando se usa de verdad. */
export const db: Db = new Proxy({} as Db, {
  get(_objetivo, propiedad, receptor) {
    return Reflect.get(getDb() as object, propiedad, receptor);
  },
});

export { schema };
export * from './schema';
