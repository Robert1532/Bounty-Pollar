'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Encabezado } from '@/components/Encabezado';
import { Estrellas, Estrella } from '@/components/Estrellas';
import { BotonSoporte } from '@/components/BotonSoporte';
import { Aviso } from '@/components/ui/Aviso';
import { Boton, Spinner, claseBoton } from '@/components/ui/Boton';
import { Icono, type NombreIcono } from '@/components/Marca';
import { get } from '@/lib/cliente/api';
import { useSesion } from '@/lib/cliente/sesion';
import type { Perfil } from '@/lib/cliente/tipos';

const ETIQUETA_NIVEL = {
  nuevo: 'Vendedor nuevo',
  conocido: 'Vendedor con historial',
  confiable: 'Vendedor confiable',
  recomendado: 'Vendedor recomendado',
} as const;

const CLASE_NIVEL = {
  nuevo: 'bg-papel-2 text-tinta-2',
  conocido: 'bg-azul-claro text-azul',
  confiable: 'bg-verde-claro text-verde-oscuro',
  recomendado: 'bg-verde text-white',
} as const;

/**
 * El perfil propio: quién eres en Caserita y qué respalda eso.
 *
 * Es privado a propósito. Un perfil público con link expondría la actividad
 * comercial completa de una persona a cualquiera; lo que un comprador necesita
 * saber de un vendedor ya se muestra en la página del trato, justo antes de
 * pagar, que es donde sirve.
 */
export default function PaginaPerfil() {
  const { usuario, cargando, entrar, ocupado, abrirHistorial } = useSesion();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    get<Perfil>('/api/perfil')
      .then((d) => vivo && setPerfil(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [usuario]);

  if (cargando) {
    return (
      <>
        <Encabezado />
        <main className="contenedor grid place-items-center py-24">
          <Spinner />
        </main>
      </>
    );
  }

  if (!usuario) {
    return (
      <>
        <Encabezado />
        <main className="contenedor space-y-4 py-10">
          <div className="columna space-y-4">
            <Aviso tono="info">Entra con tu cuenta para ver tu perfil.</Aviso>
            <Boton onClick={() => void entrar()} cargando={ocupado}>
              Iniciar sesión con Google
            </Boton>
          </div>
        </main>
      </>
    );
  }

  const rep = perfil?.reputacion;
  const nivel = rep?.nivel ?? 'nuevo';
  const totalEstrellas = perfil ? Object.values(perfil.distribucion).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <Encabezado />
      <main className="contenedor py-6 pb-16">
        <div className="columna space-y-4">
          <section className="tarjeta overflow-hidden">
            <div className="patron-casas flex items-center gap-4 bg-verde px-5 py-6 text-white">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl font-black">
                {(perfil?.nombre ?? 'C').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-black">{perfil?.nombre ?? 'Mi cuenta'}</p>
                <p className="numeros truncate text-xs text-white/70" title={usuario.direccion}>
                  {usuario.direccion.slice(0, 6)}…{usuario.direccion.slice(-6)}
                </p>
                {perfil && (
                  <p className="mt-0.5 text-[11px] text-white/60">
                    En Caserita desde {new Date(perfil.desde).toLocaleDateString('es-BO', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${CLASE_NIVEL[nivel]}`}>
                {ETIQUETA_NIVEL[nivel]}
              </span>
              {rep && <Estrellas datos={rep.estrellas} />}
            </div>
          </section>

          {!perfil ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : (
            <>
              <section className="tarjeta p-5">
                <h2 className="mb-4 text-sm font-extrabold">Tu historial</h2>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['check', String(rep!.ventasCompletadas), 'entregas cumplidas'],
                    ['wallet', Number(rep!.volumenVendidoUsdc).toFixed(2), 'USDC cobrados'],
                    ['paquete', String(rep!.comprasCompletadas), 'compras recibidas'],
                    ['reloj', String(rep!.devolucionesComoVendedor), 'devoluciones'],
                  ] as [NombreIcono, string, string][]).map(([icono, valor, etiqueta]) => (
                    <div key={etiqueta} className="rounded-2xl bg-papel-2 px-3 py-4 text-center">
                      <Icono nombre={icono} className="mx-auto mb-1.5 size-4 text-verde" />
                      <p className="numeros text-xl font-black text-verde-oscuro">{valor}</p>
                      <p className="mt-0.5 text-[11px] leading-tight font-semibold text-tinta-3">{etiqueta}</p>
                    </div>
                  ))}
                </div>
                {rep!.tasaEntrega !== null && (
                  <p className="mt-3 text-center text-xs text-tinta-3">
                    Cumpliste el <strong className="text-tinta-2">{rep!.tasaEntrega}%</strong> de tus tratos.
                  </p>
                )}
              </section>

              <section className="tarjeta p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold">Lo que dicen tus compradores</h2>
                  <span className="text-[11px] font-bold text-tinta-3">anónimo</span>
                </div>

                {totalEstrellas === 0 ? (
                  <p className="rounded-2xl bg-papel-2 px-4 py-3 text-sm text-tinta-2">
                    Todavía nadie te calificó. Cada comprador puede hacerlo una sola vez, después de
                    recibir lo que compró.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {([5, 4, 3, 2, 1] as const).map((n) => {
                      const cantidad = perfil.distribucion[String(n) as '1' | '2' | '3' | '4' | '5'] ?? 0;
                      const porcentaje = totalEstrellas === 0 ? 0 : (cantidad / totalEstrellas) * 100;
                      return (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="numeros flex w-8 shrink-0 items-center gap-0.5 font-bold text-tinta-2">
                            {n}
                            <Estrella llenado={1} className="size-3 text-naranja" />
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-papel-2">
                            <span className="block h-full rounded-full bg-naranja" style={{ width: `${porcentaje}%` }} />
                          </span>
                          <span className="numeros w-6 shrink-0 text-right text-tinta-3">{cantidad}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {rep!.estrellas.promedio === null && rep!.estrellas.cantidad > 0 && (
                  <p className="mt-3 text-xs text-tinta-3">
                    Tu promedio se muestra públicamente a partir de {rep!.estrellas.cantidad + rep!.estrellas.faltanParaMostrar}{' '}
                    calificaciones: con menos, sería fácil adivinar quién puso cuál.
                  </p>
                )}
              </section>

              <section className="tarjeta space-y-3 p-5">
                <h2 className="text-sm font-extrabold">Tu plata</h2>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl bg-papel-2 px-3 py-3">
                    <p className="numeros text-lg font-black text-azul">
                      {Number(perfil.resumen.protegidoUsdc).toFixed(2)}
                    </p>
                    <p className="text-[11px] font-semibold text-tinta-3">protegido</p>
                  </div>
                  <div className="rounded-2xl bg-papel-2 px-3 py-3">
                    <p className="numeros text-lg font-black text-naranja">
                      {Number(perfil.resumen.porCobrarUsdc).toFixed(2)}
                    </p>
                    <p className="text-[11px] font-semibold text-tinta-3">por cobrar</p>
                  </div>
                </div>
                {abrirHistorial && (
                  <button
                    onClick={abrirHistorial}
                    className="w-full rounded-2xl border border-borde bg-superficie py-3 text-sm font-bold text-tinta-2 transition hover:border-verde/30 hover:text-verde"
                  >
                    Ver mis movimientos en Stellar
                  </button>
                )}
              </section>

              <BotonSoporte />

              <Link href="/" className={claseBoton('fantasma')}>
                ← Volver a mis tratos
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
