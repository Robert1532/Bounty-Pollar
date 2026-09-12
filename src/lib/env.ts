import { z } from 'zod';

/**
 * Configuracion validada al arrancar. Si falta algo, la app no levanta: es
 * preferible un error claro en el deploy que un `undefined` firmando una
 * transaccion a las dos de la manana.
 */

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

  /** Origen publico de la app. Se usa para los links, el QR y el chequeo CSRF. */
  APP_URL: z.url(),

  /** Clave de 32+ bytes para firmar la cookie de sesion (JWT HS256). */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),

  /** Secreto que protege /api/cron/vencimientos. */
  CRON_SECRET: z.string().min(16, 'CRON_SECRET debe tener al menos 16 caracteres'),

  /** Secreto HMAC de los webhooks de Pollar (opcional: siguen en "upcoming"). */
  POLLAR_WEBHOOK_SECRET: z.string().min(16).optional(),

  /** Clave secreta de Pollar. Solo servidor, nunca el cliente. */
  POLLAR_SECRET_KEY: z.string().optional(),

  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  HORIZON_URL: z.url().optional(),

  /** Cuenta de custodia de la app. La clave privada firma liberaciones y devoluciones. */
  ESCROW_SECRET_KEY: z
    .string()
    .regex(/^S[A-Z2-7]{55}$/, 'ESCROW_SECRET_KEY debe ser una clave secreta Stellar (S...)')
    .optional(),

  USDC_ISSUER: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, 'USDC_ISSUER debe ser una dirección Stellar (G...)')
    .optional(),
  USDC_CODE: z.string().default('USDC'),

  /** Tope por trato en la v1. Decision de producto, no una limitacion tecnica. */
  MONTO_MAXIMO_USDC: z.coerce.number().positive().default(50),
  MONTO_MINIMO_USDC: z.coerce.number().positive().default(0.1),

  /** Horas que tiene el vendedor para entregar antes de la devolucion automatica. */
  HORAS_PARA_ENTREGAR: z.coerce.number().int().positive().default(48),
  /** Dias que vive un trato publicado sin comprador. */
  DIAS_VIGENCIA_TRATO: z.coerce.number().int().positive().default(7),

  /** Tipo de cambio informativo Bs/USD para mostrar la referencia. */
  TIPO_CAMBIO_BS: z.coerce.number().positive().default(6.96),

  /**
   * Modo demo: simula la cadena y el login para poder recorrer el flujo
   * completo sin claves. Jamas se habilita en produccion.
   */
  MODO_MOCK: bool,
});

const clientSchema = z.object({
  NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  NEXT_PUBLIC_MODO_MOCK: bool,
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let cachedServerEnv: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n');
}

/** Configuracion de servidor. Lanza si algo falta o esta mal formado. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${formatIssues(parsed.error)}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    if (env.MODO_MOCK) {
      throw new Error('MODO_MOCK no puede estar activo en produccion.');
    }
    if (!env.ESCROW_SECRET_KEY) {
      throw new Error('ESCROW_SECRET_KEY es obligatorio fuera del modo mock.');
    }
    if (!env.USDC_ISSUER) {
      throw new Error('USDC_ISSUER es obligatorio fuera del modo mock.');
    }
    if (!env.APP_URL.startsWith('https://')) {
      throw new Error('APP_URL debe ser https en produccion.');
    }
  }

  if (!env.MODO_MOCK && (!env.ESCROW_SECRET_KEY || !env.USDC_ISSUER)) {
    throw new Error(
      'Sin MODO_MOCK=true necesitas ESCROW_SECRET_KEY y USDC_ISSUER. Corre `npm run escrow:generar`.',
    );
  }

  cachedServerEnv = env;
  return env;
}

/**
 * Configuracion publica. En Next las NEXT_PUBLIC_* se inlinean en build, asi
 * que se referencian una por una y no por indice dinamico.
 */
export function clientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MODO_MOCK: process.env.NEXT_PUBLIC_MODO_MOCK,
  });

  if (!parsed.success) {
    throw new Error(`Variables publicas inválidas:\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function horizonUrl(): string {
  const env = serverEnv();
  if (env.HORIZON_URL) return env.HORIZON_URL;
  return env.STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

export function explorerTxUrl(hash: string, network?: 'testnet' | 'mainnet'): string {
  const net = network ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  const base = net === 'mainnet' ? 'https://stellar.expert/explorer/public' : 'https://stellar.expert/explorer/testnet';
  return `${base}/tx/${hash}`;
}
