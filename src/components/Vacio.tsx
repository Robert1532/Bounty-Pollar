export function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="tarjeta px-5 py-10 text-center">
      <p className="font-bold">{titulo}</p>
      <p className="mt-1 text-sm text-tinta-2">{detalle}</p>
    </div>
  );
}
