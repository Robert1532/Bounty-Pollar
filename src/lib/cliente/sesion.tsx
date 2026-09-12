'use client';

import { createContext, useContext } from 'react';
import type { ConfigPublica, TratoPublico, UsuarioSesion } from './tipos';

export interface EstadoSesion {
  /** Usuario del backend: existe solo despues de probar la wallet con una firma. */
  usuario: UsuarioSesion | null;
  config: ConfigPublica | null;
  cargando: boolean;
  ocupado: boolean;
  error: string | null;
  modoMock: boolean;
  /** Entra con Google (o el proveedor que ofrezca Pollar) y abre la sesion. */
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  /** Paga un trato hacia la cuenta de custodia. Devuelve el hash. */
  pagar: (trato: TratoPublico) => Promise<string>;
  /** Abre el historial de transacciones de Pollar. null en modo demo. */
  abrirHistorial: (() => void) | null;
  refrescar: () => Promise<void>;
}

export const ContextoSesion = createContext<EstadoSesion | null>(null);

export function useSesion(): EstadoSesion {
  const ctx = useContext(ContextoSesion);
  if (!ctx) throw new Error('useSesion tiene que usarse dentro de <Proveedores>');
  return ctx;
}
