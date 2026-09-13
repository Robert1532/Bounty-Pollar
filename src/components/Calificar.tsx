'use client';

import { useState } from 'react';
import { post } from '@/lib/cliente/api';
import type { Estrellas as DatosEstrellas, TratoPublico } from '@/lib/cliente/tipos';
import { Aviso } from './ui/Aviso';
import { Boton } from './ui/Boton';
import { Estrella } from './Estrellas';
import { Icono } from './Marca';

const LEYENDAS = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', 'Excelente'];

/**
 * El comprador califica al vendedor después de recibir.
 *
 * Aparece solo cuando el trato está LIBERADO —o sea, cuando hubo dinero real y
 * una entrega confirmada con el código— y una sola vez. Eso es lo que separa
 * esto de las reseñas de internet: cada estrella costó una compra.
 *
 * Se le dice al comprador que es anónima porque lo es de verdad: la fila que se
 * guarda no tiene su identificador.
 */
export function Calificar({ trato, alCalificar }: { trato: TratoPublico; alCalificar: () => void }) {
  const [elegidas, setElegidas] = useState(0);
  const [encima, setEncima] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  if (!trato.puedeCalificar && !listo) return null;

  async function enviar() {
    if (elegidas < 1) return;
    setError(null);
    setEnviando(true);
    try {
      await post<DatosEstrellas>(`/api/tratos/${trato.id}/calificar`, { estrellas: elegidas });
      setListo(true);
      alCalificar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar tu calificación.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <Aviso tono="ok">
        Gracias. Tu calificación es anónima: el vendedor ve su promedio, nunca quién puso qué.
      </Aviso>
    );
  }

  const mostradas = encima || elegidas;

  return (
    <section className="tarjeta p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-naranja-claro text-naranja">
          <Icono nombre="personas" className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold">¿Cómo te fue con el vendedor?</h2>
          <p className="text-xs text-tinta-3">Es anónimo y ayuda al próximo comprador</p>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-1.5" onMouseLeave={() => setEncima(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            aria-pressed={elegidas === n}
            onMouseEnter={() => setEncima(n)}
            onFocus={() => setEncima(n)}
            onClick={() => setElegidas(n)}
            className="rounded-lg p-1 transition active:scale-95"
          >
            <Estrella
              llenado={n <= mostradas ? 1 : 0}
              className={`size-9 transition ${n <= mostradas ? 'text-naranja' : 'text-borde'}`}
            />
          </button>
        ))}
      </div>

      <p className="mt-2 h-5 text-center text-sm font-bold text-tinta-2">{LEYENDAS[mostradas] ?? ''}</p>

      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-4">
        <Boton onClick={() => void enviar()} cargando={enviando} disabled={elegidas < 1}>
          {elegidas < 1 ? 'Elige de 1 a 5 estrellas' : 'Enviar calificación'}
        </Boton>
      </div>
    </section>
  );
}
