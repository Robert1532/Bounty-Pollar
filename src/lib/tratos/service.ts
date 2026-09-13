import { and, count, desc, eq, inArray, isNull, lte, sum, sql as sqlRaw } from 'drizzle-orm';
import { db, tratos, users, type EstadoTrato, type Trato, type User } from '@/db';
import { serverEnv } from '../env';
import { ErrorApp, errores } from '../errors';
import { log } from '../logger';
import { registrarEvento } from '../eventos';
import { asegurarWallet } from '../auth';
import { cifrar, descifrar } from '../cripto';
import { generarCodigo, hashearCodigo, MAX_INTENTOS, verificarCodigo } from '../codigo';
import { nuevoIdTrato } from '../ids';
import { aStroops, bsAUsdc, normalizarMonto } from '../money';
import { buscarDeposito, consultarTx, direccionEscrow, enviarDesdeEscrow } from '../stellar';
import type { CrearTratoInput } from '../validaciones';
import { aTratoPublico, type TratoPublico } from './dto';
import { registrarResultado } from './reputacion';
import {
  almacenamientoHabilitado,
  borrarEvidencia,
  guardarEvidencia,
  urlDeEvidencia,
} from '../almacenamiento';
import { tienePlataRetenida } from './estado';
import { decidirRecuperacion, plazoDevolucionVencido } from './politicas';

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

/**
 * La vista pública de un trato con el historial del vendedor incluido. Todas
 * las rutas devuelven esto para que la pantalla nunca pierda la reputación al
 * refrescar el estado después de una acción.
 */
export async function vistaDeTrato(trato: Trato, usuario?: User | null): Promise<TratoPublico> {
  const [vendedor] = await db.select().from(users).where(eq(users.id, trato.vendedorId)).limit(1);
  return aTratoPublico(trato, usuario, vendedor ?? null);
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
  hash?: string;
  actor?: User | null;
  ip?: string | null;
  silencioso?: boolean;
}): Promise<Trato> {
  const trato = await obtenerTrato(params.id);

  if (trato.estado !== 'PUBLICADO') {
    if (tienePlataRetenida(trato.estado) || trato.estado === 'LIBERADO' || trato.estado === 'DEVUELTO') {
      return trato; // ya confirmado
    }
    throw errores.estadoInvalido('Este trato ya no acepta pagos.');
  }

  const busqueda = await buscarDeposito({
    memo: trato.memo,
    montoEsperado: trato.montoUsdc,
    hash: params.hash,
  });

  if (busqueda.estado === 'NO_ENCONTRADO') {
    if (!params.silencioso) {
      await registrarEvento({
        tratoId: trato.id,
        tipo: 'DEPOSITO_RECHAZADO',
        payload: { motivo: 'no_encontrado', memo: trato.memo, hash: params.hash },
        actorAddr: params.actor?.walletAddress,
        ip: params.ip,
      });
    }
    throw errores.depositoNoEncontrado(
      'Todavía no vemos el pago en la red. Si acabas de pagar, espera unos segundos: volvemos a mirar solos.',
    );
  }

  if (busqueda.estado === 'MONTO_INCORRECTO') {
    const deposito = busqueda.deposito;
    await registrarEvento({
      tratoId: trato.id,
      tipo: 'DEPOSITO_RECHAZADO',
      payload: {
        motivo: 'monto_incorrecto',
        esperado: trato.montoUsdc,
        recibido: deposito.monto,
        hash: deposito.hash,
      },
      actorAddr: deposito.desde,
      ip: params.ip,
    });
    throw errores.montoIncorrecto(
      `El depósito debe ser exactamente ${normalizarMonto(trato.montoUsdc)} USDC. No se acreditó automáticamente.`,
      { hash: deposito.hash },
    );
  }

  const deposito = busqueda.deposito;

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
  let trato = await obtenerTrato(params.id);

  if (trato.vendedorId !== params.actor.id) throw errores.sinPermiso('Solo el vendedor libera el pago.');
  if (trato.estado === 'LIBERADO') return trato;
  if (trato.estado === 'LIBERANDO') {
    trato = await recuperarMovimiento({
      trato,
      desde: 'LIBERANDO',
      hacia: 'LIBERADO',
      campoTx: 'txLiberacion',
      tipoOk: 'LIBERACION_COMPLETADA',
      tipoFalla: 'LIBERACION_FALLIDA',
      actor: params.actor.walletAddress,
      ip: params.ip,
    });
    if (trato.estado === 'LIBERADO') return trato;
  }
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
 * Devolucion por plazo vencido: la dispara el cron o una de las partes desde
 * la interfaz. La plata vuelve a la direccion que realmente pago, leida de la
 * red.
 */
export async function devolver(params: {
  id: string;
  motivo: 'PLAZO_VENCIDO';
  actor?: User | null;
  ip?: string | null;
}): Promise<Trato> {
  let trato = await obtenerTrato(params.id);

  if (trato.estado === 'DEVUELTO') return trato;
  if (trato.estado === 'DEVOLVIENDO') {
    trato = await recuperarMovimiento({
      trato,
      desde: 'DEVOLVIENDO',
      hacia: 'DEVUELTO',
      campoTx: 'txDevolucion',
      tipoOk: 'DEVOLUCION_COMPLETADA',
      tipoFalla: 'DEVOLUCION_FALLIDA',
      actor: params.actor?.walletAddress ?? 'sistema',
      ip: params.ip,
    });
    if (trato.estado === 'DEVUELTO') return trato;
  }
  if (trato.estado !== 'FINANCIADO') throw errores.estadoInvalido('Este trato no tiene plata en custodia.');
  if (!trato.compradorAddress) throw errores.estadoInvalido('No sabemos a quién devolver.');

  if (!plazoDevolucionVencido(trato.liberaHasta)) {
    throw errores.estadoInvalido('Todavía no vence el plazo de entrega.');
  }
  if (params.actor && params.actor.id !== trato.compradorId && params.actor.id !== trato.vendedorId) {
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
export async function procesarVencimientos(): Promise<{
  depositosConfirmados: number;
  movimientosRecuperados: number;
  expirados: number;
  devueltos: number;
  fallidos: number;
}> {
  const ahora = new Date();

  // Recuperación duradera: aunque el comprador cierre la pestaña o el servidor
  // reinicie, el cron vuelve a buscar depósitos por el memo único del trato.
  // Los vencidos se revisan primero. Nunca expiramos filas que quedaron fuera
  // del lote ni aquellas cuya consulta a Horizon falló por un problema de red.
  const porExpirar = await db
    .select({ id: tratos.id })
    .from(tratos)
    .where(and(eq(tratos.estado, 'PUBLICADO'), lte(tratos.expiraEn, ahora)))
    .orderBy(tratos.expiraEn)
    .limit(25);

  const recientes = await db
    .select({ id: tratos.id })
    .from(tratos)
    .where(eq(tratos.estado, 'PUBLICADO'))
    .orderBy(desc(tratos.createdAt))
    .limit(25);

  const idsPorExpirar = new Set(porExpirar.map(({ id }) => id));
  const pendientes = [...new Set([...porExpirar, ...recientes].map(({ id }) => id))];

  let depositosConfirmados = 0;
  const expirables: string[] = [];
  for (const id of pendientes) {
    try {
      const confirmado = await confirmarDeposito({ id, silencioso: true });
      if (confirmado.estado !== 'PUBLICADO') depositosConfirmados += 1;
    } catch (error) {
      const ausenciaConfirmada =
        error instanceof ErrorApp && ['DEPOSITO_NO_ENCONTRADO', 'MONTO_INCORRECTO'].includes(error.codigo);
      if (ausenciaConfirmada && idsPorExpirar.has(id)) {
        expirables.push(id);
      } else if (!ausenciaConfirmada) {
        log.error('no se pudo revisar un depósito pendiente', { tratoId: id, error });
      }
    }
  }

  const ambiguos = await db
    .select()
    .from(tratos)
    .where(inArray(tratos.estado, ['LIBERANDO', 'DEVOLVIENDO']))
    .limit(25);
  let movimientosRecuperados = 0;
  for (const trato of ambiguos) {
    try {
      const recuperado =
        trato.estado === 'LIBERANDO'
          ? await recuperarMovimiento({
              trato,
              desde: 'LIBERANDO',
              hacia: 'LIBERADO',
              campoTx: 'txLiberacion',
              tipoOk: 'LIBERACION_COMPLETADA',
              tipoFalla: 'LIBERACION_FALLIDA',
              actor: 'sistema',
            })
          : await recuperarMovimiento({
              trato,
              desde: 'DEVOLVIENDO',
              hacia: 'DEVUELTO',
              campoTx: 'txDevolucion',
              tipoOk: 'DEVOLUCION_COMPLETADA',
              tipoFalla: 'DEVOLUCION_FALLIDA',
              actor: 'sistema',
            });
      if (recuperado.estado !== trato.estado) movimientosRecuperados += 1;
    } catch (error) {
      if (!(error instanceof ErrorApp) || error.detalle?.estado !== 'DESCONOCIDA') {
        log.error('no se pudo recuperar un movimiento', { tratoId: trato.id, error });
      }
    }
  }

  const expirados =
    expirables.length === 0
      ? []
      : await db
          .update(tratos)
          .set({ estado: 'EXPIRADO', cerradoEn: ahora, updatedAt: ahora })
          .where(
            and(
              inArray(tratos.id, expirables),
              eq(tratos.estado, 'PUBLICADO'),
              lte(tratos.expiraEn, ahora),
              isNull(tratos.txDeposito),
            ),
          )
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

  if (depositosConfirmados > 0 || movimientosRecuperados > 0 || expirados.length > 0 || devueltos > 0 || fallidos > 0) {
    log.info('vencimientos procesados', {
      depositosConfirmados,
      movimientosRecuperados,
      expirados: expirados.length,
      devueltos,
      fallidos,
    });
  }
  return { depositosConfirmados, movimientosRecuperados, expirados: expirados.length, devueltos, fallidos };
}

/**
 * Evidencia de entrega: una foto opcional que el vendedor adjunta al entregar.
 *
 * Es deliberadamente opcional y no condiciona la liberación. Fingir que una
 * foto resuelve una disputa sería mentir; lo que sí hace es dejar un registro
 * con hora y hash que ninguna de las dos partes puede cambiar después, y que
 * las dos pueden ver.
 */
export async function adjuntarEvidencia(params: {
  id: string;
  datos: Uint8Array;
  actor: User;
  ip?: string | null;
}): Promise<Trato> {
  if (!almacenamientoHabilitado()) {
    throw errores.estadoInvalido('Este despliegue no tiene configurado el guardado de fotos.');
  }

  const trato = await obtenerTrato(params.id);
  if (trato.vendedorId !== params.actor.id) {
    throw errores.sinPermiso('Solo el vendedor adjunta la evidencia de entrega.');
  }
  if (trato.estado !== 'FINANCIADO') {
    throw errores.estadoInvalido('La foto se adjunta mientras la plata está en custodia.');
  }

  const archivo = await guardarEvidencia({ tratoId: trato.id, datos: params.datos });
  const anterior = trato.evidenciaRuta;
  const ahora = new Date();

  const filas = await db
    .update(tratos)
    .set({
      evidenciaRuta: archivo.ruta,
      evidenciaTipo: archivo.tipo,
      evidenciaBytes: archivo.bytes,
      evidenciaHash: archivo.hash,
      evidenciaSubidaEn: ahora,
      updatedAt: ahora,
    })
    .where(and(eq(tratos.id, trato.id), eq(tratos.estado, 'FINANCIADO')))
    .returning();

  if (filas.length === 0) {
    await borrarEvidencia(archivo.ruta);
    throw errores.estadoInvalido('El trato cambió de estado mientras subías la foto.');
  }

  // Reemplazar deja huérfano el archivo anterior; se borra para no acumular.
  if (anterior && anterior !== archivo.ruta) await borrarEvidencia(anterior);

  await registrarEvento({
    tratoId: trato.id,
    tipo: 'EVIDENCIA_ADJUNTADA',
    payload: { hash: archivo.hash, bytes: archivo.bytes, tipo: archivo.tipo },
    actorAddr: params.actor.walletAddress,
    ip: params.ip,
  });

  return filas[0] as Trato;
}

/** La foto, solo para las dos partes del trato y con una URL que caduca. */
export async function evidenciaDe(params: { id: string; actor: User }): Promise<{
  url: string;
  hash: string;
  subidaEn: string;
  tipo: string;
} | null> {
  const trato = await obtenerTrato(params.id);
  if (trato.vendedorId !== params.actor.id && trato.compradorId !== params.actor.id) {
    throw errores.sinPermiso('Esta foto es de las partes del trato.');
  }
  if (!trato.evidenciaRuta || !trato.evidenciaSubidaEn) return null;

  return {
    url: await urlDeEvidencia({ tratoId: trato.id, ruta: trato.evidenciaRuta }),
    hash: trato.evidenciaHash ?? '',
    subidaEn: trato.evidenciaSubidaEn.toISOString(),
    tipo: trato.evidenciaTipo ?? 'image/jpeg',
  };
}

/**
 * Estadísticas públicas de confianza.
 *
 * Son agregados, nunca datos de una persona: cuánto hay protegido ahora mismo,
 * cuántos tratos se completaron y cuántos se devolvieron. Un comprador que
 * llega por un link de WhatsApp no conoce esta app; estos números son lo
 * primero que le dicen si vale la pena seguir. Los números chicos también se
 * muestran: esconderlos sería el primer paso para inventarlos.
 */
export async function estadisticasPublicas(): Promise<{
  protegidoAhoraUsdc: string;
  tratosEnCustodia: number;
  tratosCompletados: number;
  volumenCompletadoUsdc: string;
  tratosDevueltos: number;
  tratosTotales: number;
  personas: number;
  tasaEntrega: number | null;
}> {
  const [custodia, completados, devueltos, totales, personas] = await Promise.all([
    db
      .select({ monto: sum(tratos.montoUsdc), cantidad: count() })
      .from(tratos)
      .where(inArray(tratos.estado, ['FINANCIADO', 'LIBERANDO', 'DEVOLVIENDO'])),
    db
      .select({ monto: sum(tratos.montoUsdc), cantidad: count() })
      .from(tratos)
      .where(eq(tratos.estado, 'LIBERADO')),
    db.select({ cantidad: count() }).from(tratos).where(eq(tratos.estado, 'DEVUELTO')),
    db.select({ cantidad: count() }).from(tratos),
    db.select({ cantidad: count() }).from(users),
  ]);

  const completadosN = completados[0]?.cantidad ?? 0;
  const devueltosN = devueltos[0]?.cantidad ?? 0;
  const cerrados = completadosN + devueltosN;

  return {
    protegidoAhoraUsdc: normalizarMonto(custodia[0]?.monto ?? '0'),
    tratosEnCustodia: custodia[0]?.cantidad ?? 0,
    tratosCompletados: completadosN,
    volumenCompletadoUsdc: normalizarMonto(completados[0]?.monto ?? '0'),
    tratosDevueltos: devueltosN,
    tratosTotales: totales[0]?.cantidad ?? 0,
    personas: personas[0]?.cantidad ?? 0,
    tasaEntrega: cerrados === 0 ? null : Math.round((completadosN / cerrados) * 100),
  };
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
        const guardado = await db
          .update(tratos)
          .set({ [params.campoTx]: hash, updatedAt: new Date() })
          .where(
            and(
              eq(tratos.id, params.trato.id),
              eq(tratos.estado, params.desde),
              isNull(tratos[params.campoTx]),
            ),
          )
          .returning({ id: tratos.id });
        if (guardado.length === 0) {
          throw errores.estadoInvalido('Ya existe otra operación monetaria para este trato.');
        }
        await registrarEvento({
          tratoId: params.trato.id,
          tipo: params.desde === 'LIBERANDO' ? 'LIBERACION_INICIADA' : 'DEVOLUCION_INICIADA',
          payload: { hashFirmado: hash, destino: params.destino, monto },
        });
      },
    });

    return finalizarMovimientoConfirmado(params, resultado.hash);
  } catch (error) {
    const actual = await obtenerTrato(params.trato.id);
    if (actual.estado === params.hacia) return actual;
    if (actual.estado !== params.desde) throw error;

    const resultado = error instanceof ErrorApp ? error.detalle?.resultado : undefined;
    if (resultado === 'FALLIDA' || resultado === 'NO_ENVIADA') {
      await marcarMovimientoFallido({ ...params, trato: actual }, error);
      throw error;
    }

    // Un timeout o error de red es ambiguo. Se consulta el hash persistido y,
    // si Horizon aún no sabe qué ocurrió, el estado queda bloqueado para que
    // ninguna petición pueda construir una segunda transferencia.
    if (actual[params.campoTx]) {
      return recuperarMovimiento({ ...params, trato: actual });
    }

    await marcarMovimientoFallido({ ...params, trato: actual }, error);
    throw error;
  }
}

type MovimientoParams = {
  trato: Trato;
  desde: Extract<EstadoTrato, 'LIBERANDO' | 'DEVOLVIENDO'>;
  hacia: Extract<EstadoTrato, 'LIBERADO' | 'DEVUELTO'>;
  campoTx: 'txLiberacion' | 'txDevolucion';
  tipoOk: 'LIBERACION_COMPLETADA' | 'DEVOLUCION_COMPLETADA';
  tipoFalla: 'LIBERACION_FALLIDA' | 'DEVOLUCION_FALLIDA';
  actor: string;
  ip?: string | null;
};

async function finalizarMovimientoConfirmado(params: MovimientoParams, hash: string): Promise<Trato> {
  const ahora = new Date();
  const filas = await db
    .update(tratos)
    .set({ estado: params.hacia, [params.campoTx]: hash, cerradoEn: ahora, updatedAt: ahora })
    .where(and(eq(tratos.id, params.trato.id), eq(tratos.estado, params.desde), eq(tratos[params.campoTx], hash)))
    .returning();

  if (filas.length > 0) {
    const cerrado = filas[0] as Trato;
    await registrarEvento({
      tratoId: params.trato.id,
      tipo: params.tipoOk,
      payload: { hash },
      actorAddr: params.actor,
      ip: params.ip,
    });
    // Acá y en ningún otro lado: es la única transición que de verdad cierra el
    // trato, y el UPDATE condicionado garantiza que solo una petición llega.
    await registrarResultado({ trato: cerrado, resultado: params.hacia });
    return cerrado;
  }
  return obtenerTrato(params.trato.id);
}

async function marcarMovimientoFallido(params: MovimientoParams, error: unknown): Promise<Trato> {
  const hash = params.trato[params.campoTx];
  const filas = await db
    .update(tratos)
    .set({ estado: 'FINANCIADO', [params.campoTx]: null, updatedAt: new Date() })
    .where(and(eq(tratos.id, params.trato.id), eq(tratos.estado, params.desde)))
    .returning();
  if (filas.length > 0) {
    await registrarEvento({
      tratoId: params.trato.id,
      tipo: params.tipoFalla,
      payload: { hash, error: error instanceof Error ? error.message : 'desconocido' },
      actorAddr: params.actor,
      ip: params.ip,
    });
    return filas[0] as Trato;
  }
  return obtenerTrato(params.trato.id);
}

export async function recuperarMovimiento(params: MovimientoParams): Promise<Trato> {
  const hash = params.trato[params.campoTx];
  if (!hash) {
    return marcarMovimientoFallido(params, new Error('La operación no llegó a construirse.'));
  }

  const estado = await consultarTx(hash);
  const decision = decidirRecuperacion(estado);
  if (decision === 'ESPERAR') {
    throw errores.cadena(
      'La red todavía no confirma si la operación terminó. No se enviará otra transferencia hasta resolverla.',
      { hash, estado: 'DESCONOCIDA' },
    );
  }
  if (decision === 'REINTENTAR') {
    return marcarMovimientoFallido(params, new Error('La red confirmó que la operación falló.'));
  }
  return finalizarMovimientoConfirmado(params, hash);
}
