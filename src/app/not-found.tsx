import Link from 'next/link';
import { Isotipo } from '@/components/Marca';

export default function NoEncontrado() {
  return (
    <main className="contenedor grid min-h-dvh place-items-center py-8 text-center">
      <div className="tarjeta w-full max-w-md space-y-4 p-8">
        <Isotipo className="mx-auto size-16" />
        <p className="text-4xl font-black text-verde">404</p>
        <div><p className="text-xl font-black">No encontramos este trato</p><p className="mt-1 text-sm text-tinta-2">Puede que el enlace esté incompleto o que el trato ya no exista.</p></div>
        <Link href="/" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-verde px-5 py-3 font-extrabold text-white shadow-lg shadow-verde/15">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
