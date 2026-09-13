/**
 * Convierte tanto un link completo como `/t/XXXXXXXX` o el código solo en una
 * ruta local. Nunca navegamos al dominio pegado: extraemos el id y abrimos el
 * trato en esta instalación de Caserita.
 */
export function rutaDeTrato(valor: string): string | null {
  const limpio = valor.trim();
  if (/^[A-Z0-9_-]{8}$/i.test(limpio)) return `/t/${limpio}`;

  try {
    const url = new URL(limpio, 'http://caserita.local');
    const coincidencia = url.pathname.match(/^\/t\/([A-Z0-9_-]{8})\/?$/i);
    return coincidencia?.[1] ? `/t/${coincidencia[1]}` : null;
  } catch {
    return null;
  }
}
