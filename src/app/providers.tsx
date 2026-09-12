'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PollarProvider, usePollar } from '@pollar/react';
import { ContextoSesion, type EstadoSesion } from '@/lib/cliente/sesion';
import type { ConfigPublica, TratoPublico, UsuarioSesion } from '@/lib/cliente/tipos';
import { ErrorApi, del, get, post } from '@/lib/cliente/api';

const CLAVE_MOCK = 'caserita:wallet-demo';

/**
 * Dos implementaciones de la misma sesion: la real, sobre Pollar, y la
 * simulada, para poder recorrer el flujo sin claves. Comparten contrato, asi
 * que ninguna pantalla sabe cual esta corriendo.
 */
export function Proveedores({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY;
  const red = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
  const mock = process.env.NEXT_PUBLIC_MODO_MOCK === 'true' || !apiKey;

  if (mock) return <ProveedorMock>{children}</ProveedorMock>;

  return (
    <PollarProvider client={{ apiKey: apiKey as string, stellarNetwork: red }}>
      <ProveedorPollar>{children}</ProveedorPollar>
    </PollarProvider>
  );
}

/** Estado compartido por las dos implementaciones. */
function useBase() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    const [yo, cfg] = await Promise.all([
      get<UsuarioSesion | null>('/api/auth/yo').catch(() => null),
      get<ConfigPublica>('/api/config').catch(() => null),
    ]);
    setUsuario(yo);
    if (cfg) setConfig(cfg);
  }, []);

  useEffect(() => {
    void refrescar().finally(() => setCargando(false));
  }, [refrescar]);

  const salir = useCallback(async () => {
    await del('/api/auth/sesion').catch(() => undefined);
    setUsuario(null);
  }, []);

  return { usuario, setUsuario, config, cargando, ocupado, setOcupado, error, setError, refrescar, salir };
}

function mensajeDe(e: unknown): string {
  if (e instanceof ErrorApi) return e.message;
  if (e instanceof Error) return e.message;
  return 'Algo salió mal. Intenta de nuevo.';
}

function ProveedorPollar({ children }: { children: ReactNode }) {
  const base = useBase();
  const { login, logout, isAuthenticated, wallet, getClient, runTx, openTxHistoryModal } = usePollar();
  const [esperandoLogin, setEsperandoLogin] = useState(false);

  /**
   * Prueba de propiedad de la wallet.
   *
   * Pollar autentica al usuario en el navegador, pero el backend no puede
   * creerle al navegador cuando dice "soy G...". Asi que pide un nonce, lo hace
   * firmar con SEP-53 (`client.stellar.sep53.signMessage`) y verifica la firma
   * contra esa llave publica antes de emitir la cookie de sesion.
   */
  const abrirSesion = useCallback(
    async (direccion: string) => {
      const { mensaje } = await post<{ mensaje: string }>(
        `/api/auth/nonce?direccion=${encodeURIComponent(direccion)}`,
      );
      const prueba = await getClient().stellar.sep53.signMessage(mensaje);
      if (prueba.status !== 'signed') {
        throw new Error('No pudimos verificar tu wallet. Intenta entrar de nuevo.');
      }
      const usuario = await post<UsuarioSesion>('/api/auth/sesion', {
        mensaje,
        firma: prueba.signature,
        direccion: prueba.signerAddress,
      });
      base.setUsuario(usuario);

      // Funding mode Deferred: la cuenta existe pero sin reserva. El patrocinio
      // se pide desde el backend, que es donde vive la clave secreta.
      if (wallet?.fundingMode === 'DEFERRED' || wallet?.existsOnStellar === false) {
        await post('/api/pollar/activar').catch(() => undefined);
      }
    },
    [base, getClient, wallet?.fundingMode, wallet?.existsOnStellar],
  );

  // Cuando Pollar termina el login (popup de Google), se abre la sesion propia.
  useEffect(() => {
    if (!esperandoLogin || !isAuthenticated || !wallet?.address) return;
    setEsperandoLogin(false);
    base.setOcupado(true);
    abrirSesion(wallet.address)
      .catch((e) => base.setError(mensajeDe(e)))
      .finally(() => base.setOcupado(false));
  }, [esperandoLogin, isAuthenticated, wallet?.address, abrirSesion, base]);

  const entrar = useCallback(async () => {
    base.setError(null);
    if (isAuthenticated && wallet?.address) {
      base.setOcupado(true);
      try {
        await abrirSesion(wallet.address);
      } catch (e) {
        base.setError(mensajeDe(e));
      } finally {
        base.setOcupado(false);
      }
      return;
    }
    setEsperandoLogin(true);
    login({ provider: 'google' });
  }, [abrirSesion, base, isAuthenticated, login, wallet?.address]);

  const salir = useCallback(async () => {
    await base.salir();
    try {
      logout();
    } catch {
      /* la sesion del backend ya esta cerrada */
    }
  }, [base, logout]);

  /**
   * El pago del comprador: un `payment` de USDC a la cuenta de custodia con el
   * memo del trato. Pollar patrocina el fee, asi que el comprador nunca ve XLM.
   */
  const pagar = useCallback(
    async (trato: TratoPublico) => {
      const asset = base.config?.asset;
      if (!asset?.issuer) throw new Error('Falta configurar el emisor de USDC.');

      const resultado = await runTx(
        'payment',
        {
          destination: trato.escrowAddress,
          amount: trato.montoUsdc,
          asset: { type: 'credit_alphanum4', code: asset.code, issuer: asset.issuer },
        },
        { memo: { type: 'text', value: trato.memo } },
      );

      if (resultado.status === 'error') {
        throw new Error(resultado.message ?? resultado.details ?? 'La red rechazó el pago.');
      }
      return resultado.hash;
    },
    [base.config, runTx],
  );

  const valor: EstadoSesion = useMemo(
    () => ({
      usuario: base.usuario,
      config: base.config,
      cargando: base.cargando,
      ocupado: base.ocupado || esperandoLogin,
      error: base.error,
      modoMock: false,
      entrar,
      salir,
      pagar,
      abrirHistorial: openTxHistoryModal,
      refrescar: base.refrescar,
    }),
    [base, entrar, esperandoLogin, openTxHistoryModal, pagar, salir],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

function ProveedorMock({ children }: { children: ReactNode }) {
  const base = useBase();

  const entrar = useCallback(async () => {
    base.setError(null);
    base.setOcupado(true);
    try {
      const guardada = typeof window !== 'undefined' ? window.localStorage.getItem(CLAVE_MOCK) : null;
      const usuario = await post<UsuarioSesion>('/api/mock/sesion', guardada ? { direccion: guardada } : {});
      window.localStorage.setItem(CLAVE_MOCK, usuario.direccion);
      base.setUsuario(usuario);
    } catch (e) {
      base.setError(mensajeDe(e));
    } finally {
      base.setOcupado(false);
    }
  }, [base]);

  const pagar = useCallback(
    async (trato: TratoPublico) => {
      if (!base.usuario) throw new Error('Entra primero.');
      const deposito = await post<{ hash: string }>('/api/mock/deposito', {
        memo: trato.memo,
        monto: trato.montoUsdc,
        desde: base.usuario.direccion,
      });
      return deposito.hash;
    },
    [base.usuario],
  );

  const valor: EstadoSesion = useMemo(
    () => ({
      usuario: base.usuario,
      config: base.config,
      cargando: base.cargando,
      ocupado: base.ocupado,
      error: base.error,
      modoMock: true,
      entrar,
      salir: base.salir,
      pagar,
      abrirHistorial: null,
      refrescar: base.refrescar,
    }),
    [base, entrar, pagar],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
