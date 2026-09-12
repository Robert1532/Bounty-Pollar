import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Proveedores } from './providers';

export const metadata: Metadata = {
  title: 'Caserita — compra y vende sin miedo',
  description:
    'Plata en custodia para ventas por Facebook Marketplace y WhatsApp. El vendedor cobra cuando entrega; si no entrega, el dinero vuelve solo.',
  applicationName: 'Caserita',
  openGraph: {
    title: 'Caserita — compra y vende sin miedo',
    description: 'La plata queda en custodia hasta que se entrega el producto.',
    type: 'website',
    locale: 'es_BO',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#15803d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-BO">
      <body className="min-h-dvh">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
