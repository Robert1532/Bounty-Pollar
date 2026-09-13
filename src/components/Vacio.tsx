import { Icono } from './Marca';

export function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="tarjeta px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-verde-claro text-verde">
        <Icono nombre="paquete" className="size-7" />
      </span>
      <p className="text-lg font-black">{titulo}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-tinta-2">{detalle}</p>
    </div>
  );
}
