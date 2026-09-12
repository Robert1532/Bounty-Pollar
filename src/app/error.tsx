'use client';

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="contenedor grid min-h-dvh place-items-center text-center">
      <div className="space-y-3">
        <p className="text-xl font-black">Algo se rompió</p>
        <p className="text-tinta-2">Intenta de nuevo. Si sigue fallando, refresca la página.</p>
        <button onClick={reset} className="rounded-2xl bg-verde px-5 py-3 font-semibold text-white">
          Reintentar
        </button>
      </div>
    </main>
  );
}
