import { z } from 'zod';

/**
 * Toda entrada externa pasa por aca antes de tocar la base. Los limites de
 * largo no son decorativos: son lo que impide que alguien meta 2 MB de texto en
 * el titulo de un trato.
 */

export const direccionStellar = z
  .string()
  .trim()
  .regex(/^G[A-Z2-7]{55}$/, 'Dirección Stellar inválida');

export const idTrato = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z_-]{6,16}$/, 'Identificador de trato inválido');

export const montoUsdc = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,7})?$/, 'Monto inválido');

export const crearTratoSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Ponle un título de al menos 3 letras').max(80),
    descripcion: z.string().trim().max(500).optional().or(z.literal('')),
    lugarEntrega: z.string().trim().max(120).optional().or(z.literal('')),
    moneda: z.enum(['BS', 'USDC']),
    monto: z.coerce.number().positive('El monto tiene que ser mayor a cero'),
    telefonoComprador: z
      .string()
      .trim()
      .regex(/^[0-9+\s-]{6,20}$/, 'Teléfono inválido')
      .optional()
      .or(z.literal('')),
  })
  .strict();

export const liberarSchema = z
  .object({
    codigo: z.string().trim().regex(/^\d{6}$/, 'El código son 6 dígitos'),
  })
  .strict();

export const confirmarSchema = z
  .object({
    /** Referencia opcional que manda el cliente. Se usa solo para el log: la
     *  verdad del deposito se lee siempre de la red. */
    hash: z.string().trim().length(64).optional(),
  })
  .strict();

export const devolverSchema = z
  .object({
    motivo: z.enum(['PLAZO_VENCIDO', 'ACORDADA']).default('ACORDADA'),
  })
  .strict();

export const sesionSchema = z
  .object({
    mensaje: z.string().min(20).max(1000),
    firma: z.string().min(40).max(200),
    direccion: direccionStellar,
    nombre: z.string().trim().max(80).optional(),
  })
  .strict();

export const depositoMockSchema = z
  .object({
    memo: z.string().min(3).max(28),
    monto: montoUsdc,
    desde: direccionStellar,
  })
  .strict();

export type CrearTratoInput = z.infer<typeof crearTratoSchema>;
