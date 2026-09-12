import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * La CSP permite 'unsafe-inline' en estilos porque Next inyecta estilos en
 * linea, y conexiones a los dominios de Pollar y a Horizon, que es literalmente
 * con quien habla la app. Todo lo demas queda cerrado: sin frames de terceros,
 * sin plugins, sin referer hacia afuera.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // En desarrollo Next necesita eval para el fast refresh; en produccion no.
  const scriptSrc =
    process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://sdk.api.pollar.xyz https://server.api.pollar.xyz https://horizon.stellar.org https://horizon-testnet.stellar.org",
    "frame-src 'self' https://sdk.api.pollar.xyz",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  if (req.nextUrl.protocol === 'https:') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
