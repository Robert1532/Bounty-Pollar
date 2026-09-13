'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Campo } from './ui/Campo';
import { Boton } from './ui/Boton';
import { Icono } from './Marca';
import { rutaDeTrato } from '@/lib/cliente/trato-link';

export function AbrirTrato() {
  const router = useRouter();
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string>();

  function abrir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const ruta = rutaDeTrato(enlace);
    if (!ruta) {
      setError('Pega un enlace de Caserita válido, por ejemplo: https://caserita.app/t/ABC346XY');
      return;
    }
    setError(undefined);
    router.push(ruta);
  }

  return (
    <section className="tarjeta p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-verde-claro text-verde">
          <Icono nombre="enlace" className="size-5" />
        </span>
        <div>
          <h2 className="font-extrabold">¿Te enviaron un trato?</h2>
          <p className="mt-0.5 text-sm text-tinta-2">Pega el enlace para revisar los detalles antes de pagar.</p>
        </div>
      </div>

      <form onSubmit={abrir} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Campo
          etiqueta="Enlace del trato"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="https://…/t/ABC346XY"
          value={enlace}
          error={error}
          onChange={(evento) => {
            setEnlace(evento.target.value);
            if (error) setError(undefined);
          }}
        />
        <Boton type="submit" className="sm:w-auto sm:min-w-36">
          Abrir trato <Icono nombre="flecha" className="size-5" />
        </Boton>
      </form>
    </section>
  );
}
