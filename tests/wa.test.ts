import { describe, expect, it } from 'vitest';
import { linkWhatsApp, mensajeInvitacion, soloDigitos } from '@/lib/wa';

describe('avisos por WhatsApp', () => {
  it('limpia el teléfono', () => {
    expect(soloDigitos('+591 7000-1234')).toBe('59170001234');
  });

  it('arma el link con el texto escapado', () => {
    const link = linkWhatsApp('hola mundo & cia', '+591 70001234');
    expect(link.startsWith('https://wa.me/59170001234?text=')).toBe(true);
    expect(link).toContain('hola%20mundo%20%26%20cia');
  });

  it('funciona sin número, para compartir por el selector del sistema', () => {
    expect(linkWhatsApp('hola').startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('la invitacion nombra el monto y el link', () => {
    const texto = mensajeInvitacion({ titulo: 'Taza', monto: '1.00', url: 'https://caserita.app/t/ABC' });
    expect(texto).toContain('Taza');
    expect(texto).toContain('1.00 USDC');
    expect(texto).toContain('https://caserita.app/t/ABC');
  });
});
