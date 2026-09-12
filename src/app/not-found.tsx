import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="contenedor grid min-h-dvh place-items-center text-center">
      <div className="space-y-3">
        <p className="text-4xl font-black">404</p>
        <p className="text-tinta-2">Ese trato no existe o ya se borró.</p>
        <Link href="/" className="inline-block rounded-2xl bg-verde px-5 py-3 font-semibold text-white">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
