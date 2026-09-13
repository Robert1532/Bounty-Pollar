'use client';

import { Icono, Isotipo } from '@/components/Marca';

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="contenedor grid min-h-dvh place-items-center py-8 text-center">
      <div className="tarjeta w-full max-w-md space-y-4 p-8">
        <Isotipo className="mx-auto size-16" />
        <p className="text-2xl font-black">Algo no salió bien</p>
        <p className="text-sm leading-relaxed text-tinta-2">Tu dinero no se moverá por este error. Intenta otra vez o refresca la página.</p>
        <button onClick={reset} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-verde px-5 py-3 font-extrabold text-white shadow-lg shadow-verde/15">
          Reintentar <Icono nombre="flecha" className="size-4" />
        </button>
      </div>
    </main>
  );
}
