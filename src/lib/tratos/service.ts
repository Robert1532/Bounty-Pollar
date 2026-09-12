import { and, desc, eq, isNull, lte, sql as sqlRaw } from 'drizzle-orm';
import { db, tratos, type EstadoTrato, type MotivoDevolucion, type Trato, type User } from '@/db';
import { serverEnv } from '../env';
import { ErrorApp, errores } from '../errors';
import { log } from '../logger';
import { registrarEvento } from '../eventos';
import { asegurarWallet } from '../auth';
import { cifrar, descifrar } from '../cripto';
import { generarCodigo, hashearCodigo, MAX_INTENTOS, verificarCodigo } from '../codigo';
import { nuevoIdTrato } from '../ids';
import { aStroops, bsAUsdc, normalizarMonto } from '../money';
import { buscarDeposito, direccionEscrow, enviarDesdeEscrow } from '../stellar';
import type { CrearTratoInput } from '../validaciones';
import { tienePlataRetenida } from './estado';

/**
 * Toda la logica de negocio del trato. Las rutas de API solo autentican,
 * validan y llaman aca: asi la maquina de estados tiene un solo dueno.
 *
 * La regla que se repite en cada funcion y que es el nucleo de la seguridad:
 * ninguna transicion que mueve plata se hace con un UPDATE a secas. Se hace
 * condicionada al estado esperado, y si no afecta ninguna fila es porque otra
 * peticion llego primero. Eso es lo que hace que dos toques al boton no paguen
 * dos veces.
 */

export interface TratoCreado {
  trato: Trato;
  url: string;
}

export async function crearTrato(params: {
  vendedor: User;
  datos: CrearTratoInput;
  ip?: string | null;
}): Promise<TratoCreado> {
  const env = serverEnv();
  const { datos, vendedor } = params;

  const montoUsdc =
    datos.moneda === 'BS'
      ? bsAUsdc(datos.monto, env.TIPO_CAMBIO_BS)
      : normalizarMonto(datos.monto.toFixed(7));

  const stroops = aStroops(montoUsdc);
  if (stroops > aStroops(env.MONTO_MAXIMO_USDC.toFixed(7))) {
    throw errores.datosInvalidos(`En esta versión el máximo por trato es ${env.MONTO_MAXIMO_USDC} USDC.`);
  }
  if (stroops < aStroops(env.MONTO_MINIMO_USDC.toFixed(7))) {
    throw errores.datosInvalidos(`El mínimo por trato es ${env.MONTO_MINIMO_USDC} USDC.`);
  }

  const codigo = generarCodigo();
  const codigoHash = await hashearCodigo(codigo);
  const codigoCifrado = cifrar(codigo);

  const id = nuevoIdTrato();
  const ahora = new Date();

  const [trato] = await db
    .insert(tratos)
    .values({
      id,
      memo: `CAS-${id}`,
      vendedorId: vendedor.id,
      vendedorAddress: vendedor.walletAddress,
      titulo: datos.titulo,
      descripcion: datos.descripcion || null,
      lugarEntrega: datos.lugarEntrega || null,
      montoUsdc,
      montoBsReferencia:
        datos.moneda === 'BS' ? datos.monto.toFixed(2) : (datos.monto * env.TIPO_CAMBIO_BS).toFixed(2),
      tipoCambioBs: env.TIPO_CAMBIO_BS.toFixed(4),
      codigoHash,
      codigoCifrado,
      escrowAddress: direccionEscrow(),
      estado: 'PUBLICADO',
      expiraEn: new Date(ahora.getTime() + env.DIAS_VIGENCIA_TRATO * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!trato) throw errores.datosInvalidos('No pudimos crear el trato.');

  await registrarEvento({
    tratoId: trato.id,
    tipo: 'TRATO_CREADO',
    payload: { montoUsdc, moneda: datos.moneda },
    actorAddr: vendedor.walletAddress,
    ip: params.ip,
  });

  return { trato, url: `${env.APP_URL}/t/${trato.id}` };
}

export async function obtenerTrato(id: string): Promise<Trato> {
  const [trato] = await db.select().from(tratos).where(eq(tratos.id, id)).limit(1);
  if (!trato) throw errores.noEncontrado();
  return trato;
}

export async function listarTratosDe(userId: string): Promise<{ vendo: Trato[]; compro: Trato[] }> {
  const [vendo, compro] = await Promise.all([
    db.select().from(tratos).where(eq(tratos.vendedorId, userId)).orderBy(desc(tratos.createdAt)).limit(50),
    db.select().from(tratos).where(eq(tratos.compradorId, userId)).orderBy(desc(tratos.createdAt)).limit(50),
  ]);
  return { vendo, compro };
}

/**
 * Pasa un trato a FINANCIADO despues de comprobar el deposito *en la red*.
 *
 * Ni el monto ni el remitente salen nunca del cliente: los dos se leen de
 * Horizon. Un comprador puede mentir en el body de la peticion; no puede
 * mentirle a la red. Es idempotente: llamarla diez veces deja el mismo estado.
 */
export async function confirmarDeposito(params: {
  id: string;
  actor?: User | null;
  ip?: string | null;
}): Promise<Trato> {
  const trato = await obtenerTrato(params.id);

  if (trato.estado !== 'PUBLICADO') {
    if (tienePlataRetenida(trato.estado) || trato.estado === 'LIBERADO' || trato.estado === 'DEVUELTO') {
      return trato; // ya confirmado
    }
    throw errores.estadoInvalido('Este trato ya no acepta pagos.');
  }

  const deposito = await buscarDeposito({ memo: trato.memo, montoMinimo: trato.montoUsdc });

  if (!deposito) {
    await registrarEvento({
      tratoId: trato.id,
      tipo: 'DEPOSITO_RECHAZADO',
      payload: { motivo: 'no_encontrado', memo: trato.memo },
      actorAddr: params.actor?.walletAddress,
      ip: params.ip,
    });
    throw errores.estadoInvalido(
      'Todavía no vemos el pago en la red. Si acabas de pagar, espera unos segundos: volvemos a mirar solos.',
    );
  }

  const env = serverEnv();
  const comprador = await asegurarWallet(deposito.desde);
  const ahora = new Date();

  const filas = await db
    .update(tratos)
    .set({
      estado: 'FINANCIADO',
      compradorId: comprador.id,
      compradorAddress: deposito.desde,
      txDeposito: deposito.hash,
      financiadoEn: ahora,
      liberaHasta: new Date(ahora.getTime() + env.HORAS_PARA_ENTREGAR * 60 * 60 * 1000),
      updatedAt: ahora,
    })
    .where(and(eq(tratos.id, trato.id), eq(tratos.estado, 'PUBLICADO')))
    .returning();

  if (filas.length === 0) return obtenerTrato(trato.id); // otra peticion gano la carrera

  await registrarEvento({
    tratoId: trato.id,
    tipo: 'DEPOSITO_DETECTADO',
    payload: { hash: deposito.hash, monto: deposito.monto, desde: deposito.desde },
    actorAddr: deposito.desde,
    ip: params.ip,
  });

  log.info('trato financiado', { tratoId: trato.id, hash: deposito.hash });
  return filas[0] as Trato;
}

/**
 * El vendedor ingresa el codigo y cobra.
 *
 * El contador de intentos se incrementa en la base (no en memoria): cinco
 * fallidos bloquean el trato y la plata vuelve al comprador cuando venza el
 * plazo. Sin eso, 10^6 combinaciones se prueban en minutos.
 */
export async function liberar(params: {
  id: string;
  codigo: string;
  actor: User;
  ip?: string | null;
}): Promise<Trato> {
  const trato = await obtenerTrato(params.id);

  if (trato.vendedorId !== params.actor.id) throw errores.sinPermiso('Solo el vendedor libera el pago.');
  if (trato.estado === 'LIBERADO') return trato;
  if (trato.estado !== 'FINANCIADO') throw errores.estadoInvalido('Este trato no tiene plata lista para liberar.');
  if (trato.codigoBloqueado) {
    throw new ErrorApp(
      'CODIGO_BLOQUEADO',
      'Se agotaron los intentos. Por seguridad la plata se devuelve al vencer el plazo.',
    );
  }
  if (!trato.compradorAddress) {
    throw errores.estadoInvalido('Falta el dato del comprador. Vuelve a confirmar el pago.');
  }

  if (!(await verificarCodigo(params.codigo, trato.codigoHash))) {
    const [actualizado] = await db
      .update(tratos)
      .set({ codigoIntentos: sqlRaw`${tratos.codigoIntentos} + 1`, updatedAt: new Date() })
      .where(eq(tratos.id, trato.id))
      .returning({ intentos: tratos.codigoIntentos });

    const intentos = actualizado?.intentos ?? trato.codigoIntentos + 1;
    const restantes = Math.max(0, MAX_INTENTOS - intentos);

    await registrarEvento({
      tratoId: trato.id,
      tipo: 'CODIGO_INTENTO_FALLIDO',
      payload: { intentos },
      actorAddr: params.actor.walletAddress,
      ip: params.ip,
    });

    if (restantes === 0) {
      await db.update(tratos).set({ codigoBloqueado: true }).where(eq(tratos.id, trato.id));
      await registrarEvento({
        tratoId: trato.id,
        tipo: 'CODIGO_BLOQUEADO',
        actorAddr: params.actor.walletAddress,
        ip: params.ip,
      });
      throw new ErrorApp(
        'CODIGO_BLOQUEADO',
        'Se agotaron los 5 intentos. La plata vuelve al comprador cuando venza el plazo.',
      );
    }

    throw new ErrorApp(
      'CODIGO_INCORRECTO',
      `Código incorrecto. Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`}.`,
    );
  }

  // Candado: solo una peticion consigue pasar a LIBERANDO.
  const tomado = await db
    .update(tratos)
    .set({ estado: 'LIBERANDO', updatedAt: new Date() })
    .where(and(eq(tratos.id, trato.id), eq(tratos.estado, 'FINANCIADO')))
    .returning({ id: tratos.id });
  if (tomado.length === 0) return obtenerTrato(trato.id);

  return moverPlata({
    trato,
    destino: trato.vendedorAddress,
    memo: `${trato.memo}-L`,
    desde: 'LIBERANDO',
    hacia: 'LIBERADO',
    campoTx: 'txLiberacion',
    tipoOk: 'LIBERACION_COMPLETADA',
    tipoFalla: 'LIBERACION_FALLIDA',
    actor: params.actor.walletAddress,
    ip: params.ip,
  });
}

/**
 * Devolucion: por plazo vencido (la dispara el cron) o acordada (la dispara el
 * comprador). En los dos casos la plata vuelve a la direccion que realmente
 * pago, leida de la red.
 */
export async function devolver(params: {
  id: string;
  motivo: MotivoDevolucion;
  actor?: User | null;
  ip?: string | null;
}): Promise<Trato> {
  const trato = await obtenerTrato(params.id);

  if (trato.estado === 'DEVUELTO') return trato;
  if (trato.estado !== 'FINANCIADO') throw errores.estadoInvalido('Este trato no tiene plata en custodia.');
  if (!trato.compradorAddress) throw errores.estadoInvalido('No sabemos a quién devolver.');

  if (params.motivo === 'ACORDADA') {
    if (!params.actor || params.actor.id !== trato.compradorId) {
      throw errores.sinPermiso('Solo el comprador puede soltar la devolución antes del plazo.');
    }
  } else if (trato.liberaHasta && trato.liberaHasta > new Date()) {
    throw errores.estadoInvalido('Todavía no vence el plazo de entrega.');
  } else if (params.actor && params.actor.id !== trato.compradorId && params.actor.id !== trato.vendedorId) {
    // El cron llama sin actor. Una persona solo puede empujar la devolucion de
    // un trato del que es parte, aunque el plazo ya haya vencido.
    throw errores.sinPermiso();
  }

  const tomado = await db
    .update(tratos)
    .set({ estado: 'DEVOLVIENDO', motivoDevolucion: params.motivo, updatedAt: new Date() })
    .where(and(eq(tratos.id, trato.id), eq(tratos.estado, 'FINANCIADO')))
    .returning({ id: tratos.id });
  if (tomado.length === 0) return obtenerTrato(trato.id);

  return moverPlata({
    trato,
    destino: trato.compradorAddress,
    memo: `${trato.memo}-D`,
    desde: 'DEVOLVIENDO',
    hacia: 'DEVUELTO',
    campoTx: 'txDevolucion',
    tipoOk: 'DEVOLUCION_COMPLETADA',
    tipoFalla: 'DEVOLUCION_FALLIDA',
    actor: params.actor?.walletAddress ?? 'sistema',
    ip: params.ip,
  });
}

export async function cancelar(params: { id: string; actor: User; ip?: string | null }): Promise<Trato> {
  const trato = await obtenerTrato(params.id);
  if (trato.vendedorId !== params.actor.id) throw errores.sinPermiso();
  if (trato.estado === 'CANCELADO') return trato;
  if (trato.estado !== 'PUBLICADO') {
    throw errores.estadoInvalido('Solo se puede cancelar un trato que nadie pagó todavía.');
  }

  const filas = await db
    .update(tratos)
    .set({ estado: 'CANCELADO', cerradoEn: new Date(), updatedAt: new Date() })
    .where(and(eq(tratos.id, trato.id), eq(tratos.estado, 'PUBLICADO')))
    .returning();
  if (filas.length === 0) return obtenerTrato(trato.id);

  await registrarEvento({
    tratoId: trato.id,
    tipo: 'TRATO_CANCELADO',
    actorAddr: params.actor.walletAddress,
    ip: params.ip,
  });
  return filas[0] as Trato;
}

/** El codigo de entrega, solo para el comprador y solo con la plata en custodia. */
export async function codigoParaComprador(params: { id: string; actor: User }): Promise<string> {
  const trato = await obtenerTrato(params.id);
  if (trato.compradorId !== params.actor.id) throw errores.sinPermiso('Este código es del comprador.');
  if (!tienePlataRetenida(trato.estado)) {
    throw errores.estadoInvalido('El código aparece cuando el pago está en custodia.');
  }
  return descifrar(trato.codigoCifrado);
}

/**
 * Barrido de vencimientos. Idempotente y seguro de correr cada 15 minutos:
 * expira lo que nadie pago y devuelve lo que paso el plazo de entrega. Esta
 * funcion *es* el sistema de disputas de la v1.
 */
export async function procesarVencimientos(): Promise<{ expirados: number; devueltos: number; fallidos: number }> {
  const ahora = new Date();

  const expirados = await db
    .update(tratos)
    .set({ estado: 'EXPIRADO', cerradoEn: ahora, updatedAt: ahora })
    .where(and(eq(tratos.estado, 'PUBLICADO'), lte(tratos.expiraEn, ahora), isNull(tratos.txDeposito)))
    .returning({ id: tratos.id });

  for (const { id } of expirados) {
    await registrarEvento({ tratoId: id, tipo: 'TRATO_EXPIRADO', actorAddr: 'sistema' });
  }

  const porDevolver = await db
    .select({ id: tratos.id })
    .from(tratos)
    .where(and(eq(tratos.estado, 'FINANCIADO'), lte(tratos.liberaHasta, ahora)))
    .limit(25);

  let devueltos = 0;
  let fallidos = 0;
  for (const { id } of porDevolver) {
    try {
      await devolver({ id, motivo: 'PLAZO_VENCIDO' });
      devueltos += 1;
    } catch (error) {
      fallidos += 1;
      log.error('no se pudo devolver un trato vencido', { tratoId: id, error });
    }
  }

  if (expirados.length > 0 || devueltos > 0 || fallidos > 0) {
    log.info('vencimientos procesados', { expirados: expirados.length, devueltos, fallidos });
  }
  return { expirados: expirados.length, devueltos, fallidos };
}

/**
 * El unico lugar del sistema que manda dinero hacia afuera.
 *
 * Registra el hash *antes* de enviar: si el envio se corta por timeout, el hash
 * queda en el log de eventos y se puede averiguar despues si en realidad entro,
 * en vez de pagar dos veces. Si la red rechaza, el trato vuelve a FINANCIADO
 * para poder reintentar.
 */
async function moverPlata(params: {
  trato: Trato;
  destino: string;
  memo: string;
  desde: Extract<EstadoTrato, 'LIBERANDO' | 'DEVOLVIENDO'>;
  hacia: Extract<EstadoTrato, 'LIBERADO' | 'DEVUELTO'>;
  campoTx: 'txLiberacion' | 'txDevolucion';
  tipoOk: 'LIBERACION_COMPLETADA' | 'DEVOLUCION_COMPLETADA';
  tipoFalla: 'LIBERACION_FALLIDA' | 'DEVOLUCION_FALLIDA';
  actor: string;
  ip?: string | null;
}): Promise<Trato> {
  const monto = normalizarMonto(params.trato.montoUsdc);

  await registrarEvento({
    tratoId: params.trato.id,
    tipo: params.desde === 'LIBERANDO' ? 'LIBERACION_INICIADA' : 'DEVOLUCION_INICIADA',
    payload: { destino: params.destino, monto },
    actorAddr: params.actor,
    ip: params.ip,
  });

  try {
    const resultado = await enviarDesdeEscrow({
      destino: params.destino,
      monto,
      memo: params.memo,
      alConstruir: async (hash) => {
        await registrarEvento({
          tratoId: params.trato.id,
          tipo: params.desde === 'LIBERANDO' ? 'LIBERACION_INICIADA' : 'DEVOLUCION_INICIADA',
          payload: { hashFirmado: hash, destino: params.destino, monto },
        });
      },
    });

    const ahora = new Date();
    const filas = await db
      .update(tratos)
      .set({
        estado: params.hacia,
        [params.campoTx]: resultado.hash,
        cerradoEn: ahora,
        updatedAt: ahora,
      })
      .where(and(eq(tratos.id, params.trato.id), eq(tratos.estado, params.desde)))
      .returning();

    await registrarEvento({
      tratoId: params.trato.id,
      tipo: params.tipoOk,
      payload: { hash: resultado.hash, destino: params.destino, monto },
      actorAddr: params.actor,
      ip: params.ip,
    });

    return (filas[0] as Trato | undefined) ?? obtenerTrato(params.trato.id);
  } catch (error) {
    await db
      .update(tratos)
      .set({ estado: 'FINANCIADO', updatedAt: new Date() })
      .where(and(eq(tratos.id, params.trato.id), eq(tratos.estado, params.desde)));

    await registrarEvento({
      tratoId: params.trato.id,
      tipo: params.tipoFalla,
      payload: { error: error instanceof Error ? error.message : 'desconocido' },
      actorAddr: params.actor,
      ip: params.ip,
    });
    throw error;
  }
}
