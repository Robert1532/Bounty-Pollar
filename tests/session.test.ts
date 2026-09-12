import { describe, expect, it } from 'vitest';
import { opcionesCookieSesion } from '@/lib/session';

describe('cookie de sesión', () => {
  it('crea y elimina la cookie __Host con Secure en producción', () => {
    expect(opcionesCookieSesion(true, 0)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  });

  it('mantiene la cookie local sin Secure', () => {
    expect(opcionesCookieSesion(false, 60).secure).toBe(false);
  });
});
