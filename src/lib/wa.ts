/**
 * Avisos por WhatsApp con enlaces wa.me pre-llenados: cero infraestructura,
 * cero API de terceros, y es exactamente donde ya ocurre la conversacion.
 */

export function linkWhatsApp(texto: string, telefono?: string): string {
  const base = telefono ? `https://wa.me/${soloDigitos(telefono)}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(texto)}`;
}

export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

export function mensajeInvitacion(params: { titulo: string; monto: string; url: string }): string {
  return [
    `Hola! Te paso el link para pagar *${params.titulo}* por Caserita.`,
    '',
    `Monto: ${params.monto} USDC`,
    params.url,
    '',
    'Tu plata queda en custodia: el vendedor recien cobra cuando le muestras el código de entrega.',
  ].join('\n');
}

export function mensajePagado(params: { titulo: string; url: string }): string {
  return [
    `Ya pagué *${params.titulo}* en Caserita. La plata está en custodia.`,
    '',
    'Cuando me entregues te muestro el código de 6 dígitos y se libera al instante.',
    params.url,
  ].join('\n');
}
