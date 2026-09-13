import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Esquema de Caserita. Postgres + Drizzle.
 *
 * Todo monto vive en `numeric`, nunca en float: USDC en Stellar tiene 7
 * decimales y un `double` los pierde justo donde mas duele. Drizzle devuelve
 * `numeric` como string, que es exactamente lo que consume Stellar.
 */

export const estadoTrato = pgEnum('estado_trato', [
  'BORRADOR',
  'PUBLICADO',
  'FINANCIADO',
  'LIBERANDO',
  'LIBERADO',
  'DEVOLVIENDO',
  'DEVUELTO',
  'EXPIRADO',
  'CANCELADO',
]);

export const tipoEvento = pgEnum('tipo_evento', [
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
  'WEBHOOK_RECIBIDO',
  'EVIDENCIA_ADJUNTADA',
  'CALIFICACION_RECIBIDA',
  'PROBLEMA_REPORTADO',
]);

export const motivoDevolucion = pgEnum('motivo_devolucion', ['PLAZO_VENCIDO', 'ACORDADA']);

/**
 * Un usuario es, en el fondo, una wallet Stellar creada por Pollar al entrar
 * con Google. No hay contrasena que robar ni que resetear: la identidad se
 * prueba firmando un mensaje con esa wallet.
 */
export const users = pgTable('users', {
  id: varchar('id', { length: 24 }).primaryKey(),
  walletAddress: varchar('wallet_address', { length: 56 }).notNull().unique(),
  pollarUserId: varchar('pollar_user_id', { length: 64 }),
  nombre: varchar('nombre', { length: 80 }),
  telefono: varchar('telefono', { length: 20 }),
  /** Avatar privado en Supabase Storage. La API sirve los bytes al dueño. */
  avatarRuta: varchar('avatar_ruta', { length: 200 }),
  avatarTipo: varchar('avatar_tipo', { length: 40 }),
  avatarActualizadoEn: timestamp('avatar_actualizado_en', { withTimezone: true }),

  /**
   * Reputación. No son estrellas ni reseñas: son hechos que ya ocurrieron
   * on-chain y que esta app puede demostrar. Se guardan como contadores en vez
   * de calcularse con un COUNT en cada lectura porque la página pública del
   * trato los muestra antes de que el comprador pague. La fuente de verdad
   * sigue siendo la tabla `tratos`: `recalcularReputacion()` los reconstruye
   * desde cero cuando haga falta.
   */
  ventasCompletadas: integer('ventas_completadas').notNull().default(0),
  comprasCompletadas: integer('compras_completadas').notNull().default(0),
  devolucionesComoVendedor: integer('devoluciones_como_vendedor').notNull().default(0),
  devolucionesComoComprador: integer('devoluciones_como_comprador').notNull().default(0),
  /** USDC efectivamente cobrado como vendedor en tratos liberados. */
  volumenVendidoUsdc: numeric('volumen_vendido_usdc', { precision: 20, scale: 7 }).notNull().default('0'),
  /** Cuándo cerró su primer trato: "vende acá desde…" pesa más que un número. */
  primerTratoEn: timestamp('primer_trato_en', { withTimezone: true }),

  /**
   * Calificaciones recibidas como vendedor. Se guarda la suma y la cantidad,
   * no el promedio: así sumar una nueva es un UPDATE y no hay que recalcular
   * nada, y el promedio se deriva cuando se muestra.
   */
  calificacionesRecibidas: integer('calificaciones_recibidas').notNull().default(0),
  sumaEstrellas: integer('suma_estrellas').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tratos = pgTable(
  'tratos',
  {
    /** nanoid corto y sin caracteres ambiguos: es lo que va en el link. */
    id: varchar('id', { length: 16 }).primaryKey(),

    vendedorId: varchar('vendedor_id', { length: 24 })
      .notNull()
      .references(() => users.id),
    compradorId: varchar('comprador_id', { length: 24 }).references(() => users.id),

    titulo: varchar('titulo', { length: 80 }).notNull(),
    descripcion: varchar('descripcion', { length: 500 }),
    lugarEntrega: varchar('lugar_entrega', { length: 120 }),

    /** La unidad de verdad: es lo que se verifica on-chain. */
    montoUsdc: numeric('monto_usdc', { precision: 20, scale: 7 }).notNull(),
    /** Referencia informativa al momento de crear el trato. */
    montoBsReferencia: numeric('monto_bs_referencia', { precision: 20, scale: 2 }),
    tipoCambioBs: numeric('tipo_cambio_bs', { precision: 10, scale: 4 }),

    estado: estadoTrato('estado').notNull().default('PUBLICADO'),

    /** bcrypt del codigo: el camino de verificacion. */
    codigoHash: varchar('codigo_hash', { length: 80 }).notNull(),
    /** El mismo codigo con AES-256-GCM, para poder volver a mostrarselo al
     *  comprador. La clave vive en el entorno, nunca en la base. */
    codigoCifrado: varchar('codigo_cifrado', { length: 200 }).notNull(),
    codigoIntentos: integer('codigo_intentos').notNull().default(0),
    codigoBloqueado: boolean('codigo_bloqueado').notNull().default(false),

    escrowAddress: varchar('escrow_address', { length: 56 }).notNull(),
    /** Identifica el deposito de este trato dentro de la cuenta de custodia. */
    memo: varchar('memo', { length: 28 }).notNull().unique(),

    /** Direccion desde la que llego el deposito real, leida de la red. Es la
     *  fuente de verdad sobre quien es el comprador y a donde se devuelve. */
    compradorAddress: varchar('comprador_address', { length: 56 }),
    vendedorAddress: varchar('vendedor_address', { length: 56 }).notNull(),

    txDeposito: varchar('tx_deposito', { length: 64 }).unique(),
    txLiberacion: varchar('tx_liberacion', { length: 64 }).unique(),
    txDevolucion: varchar('tx_devolucion', { length: 64 }).unique(),

    motivoDevolucion: motivoDevolucion('motivo_devolucion'),

    /** Un reporte congela el uso del código mientras el dinero sigue en custodia. */
    reporteMotivo: varchar('reporte_motivo', { length: 32 }),
    reporteDetalle: varchar('reporte_detalle', { length: 500 }),
    reportadoEn: timestamp('reportado_en', { withTimezone: true }),

    /**
     * Evidencia de entrega: una foto opcional que el vendedor adjunta al
     * entregar. No es prueba legal y no condiciona la liberación — fingir que
     * una foto resuelve una disputa sería mentir. Lo que sí hace es dejar un
     * registro con hora y hash que ninguna de las dos partes puede cambiar
     * después.
     *
     * La foto vive en un bucket privado de Supabase Storage: la base guarda la
     * ruta, nunca los bytes ni una URL pública.
     */
    evidenciaRuta: varchar('evidencia_ruta', { length: 200 }),
    evidenciaTipo: varchar('evidencia_tipo', { length: 40 }),
    evidenciaBytes: integer('evidencia_bytes'),
    /** SHA-256 del archivo: permite demostrar que la foto no se cambió después. */
    evidenciaHash: varchar('evidencia_hash', { length: 64 }),
    evidenciaSubidaEn: timestamp('evidencia_subida_en', { withTimezone: true }),

    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    financiadoEn: timestamp('financiado_en', { withTimezone: true }),
    /** Plazo para entregar. Vencido, la plata vuelve sola. */
    liberaHasta: timestamp('libera_hasta', { withTimezone: true }),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tratos_vendedor_idx').on(t.vendedorId, t.createdAt),
    index('tratos_comprador_idx').on(t.compradorId, t.createdAt),
    index('tratos_vencimiento_idx').on(t.estado, t.liberaHasta),
    index('tratos_expiracion_idx').on(t.estado, t.expiraEn),
  ],
);

/**
 * Log de auditoria: toda transicion y todo intento fallido deja rastro. Es lo
 * que permite responder "que paso con este trato" sin adivinar.
 */
export const eventos = pgTable(
  'eventos',
  {
    id: varchar('id', { length: 24 }).primaryKey(),
    tratoId: varchar('trato_id', { length: 16 })
      .notNull()
      .references(() => tratos.id, { onDelete: 'cascade' }),
    tipo: tipoEvento('tipo').notNull(),
    payload: jsonb('payload').notNull().default({}),
    actorAddr: varchar('actor_addr', { length: 56 }),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('eventos_trato_idx').on(t.tratoId, t.createdAt)],
);

/**
 * Calificación del vendedor: de 1 a 5 estrellas, una sola por trato.
 *
 * Es anónima, y eso se sostiene en el esquema, no en una promesa de la
 * interfaz: **esta tabla no tiene comprador_id**. El permiso para calificar se
 * verifica contra `tratos.comprador_id` en el momento de escribir y después no
 * queda rastro de quién puso qué en la fila.
 *
 * `trato_id` es único: un trato entregado da derecho a exactamente una
 * calificación, así que nadie puede inflar ni hundir a un vendedor calificando
 * varias veces. Y como solo se puede calificar un trato LIBERADO, cada estrella
 * cuesta una compra real con dinero real — que es justamente lo que no tienen
 * las reseñas que se compran por internet.
 */
export const calificaciones = pgTable(
  'calificaciones',
  {
    id: varchar('id', { length: 24 }).primaryKey(),
    /** Único: un trato, una calificación. */
    tratoId: varchar('trato_id', { length: 16 })
      .notNull()
      .unique()
      .references(() => tratos.id, { onDelete: 'cascade' }),
    /** A quién se calificó. Nunca se guarda quién calificó. */
    vendedorId: varchar('vendedor_id', { length: 24 })
      .notNull()
      .references(() => users.id),
    estrellas: integer('estrellas').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('calificaciones_vendedor_idx').on(t.vendedorId, t.createdAt),
    check('calificaciones_rango', sql`${t.estrellas} between 1 and 5`),
  ],
);

/**
 * Nonces de login: se emite uno, se firma con SEP-53 y se quema al usarlo. Sin
 * esto, una firma capturada serviria para siempre.
 */
export const authNonces = pgTable(
  'auth_nonces',
  {
    nonce: varchar('nonce', { length: 64 }).primaryKey(),
    usadoEn: timestamp('usado_en', { withTimezone: true }),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_nonces_expira_idx').on(t.expiraEn)],
);

export type User = typeof users.$inferSelect;
export type Trato = typeof tratos.$inferSelect;
export type Evento = typeof eventos.$inferSelect;
export type Calificacion = typeof calificaciones.$inferSelect;
export type EstadoTrato = (typeof estadoTrato.enumValues)[number];
export type TipoEvento = (typeof tipoEvento.enumValues)[number];
export type MotivoDevolucion = (typeof motivoDevolucion.enumValues)[number];
