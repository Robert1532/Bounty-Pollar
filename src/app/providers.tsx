'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PollarProvider, usePollar } from '@pollar/react';
import { ContextoSesion, type EstadoSesion } from '@/lib/cliente/sesion';
import type { ConfigPublica, TratoPublico, UsuarioSesion } from '@/lib/cliente/tipos';
import { ErrorApi, del, get, post } from '@/lib/cliente/api';

const CLAVE_MOCK = 'caserita:wallet-demo';
const ERROR_WALLET_NO_ACTIVA =
  'Tu wallet Pollar todavía no está activada en testnet. Actívala desde Account Funding.';

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
    try {
      await del('/api/auth/sesion');
    } finally {
      setUsuario(null);
    }
  }, []);

  return { usuario, setUsuario, config, cargando, ocupado, setOcupado, error, setError, refrescar, salir };
}

function mensajeDe(e: unknown): string {
  if (e instanceof ErrorApi) return e.message;
  if (e instanceof Error) return mensajePollar(e.message);
  return 'Algo salió mal. Intenta de nuevo.';
}

/**
 * Traduce el resultado de una transacción rechazada por Stellar.
 *
 * `txFeeBumpInnerFailed` es el código de la transacción *envolvente*: Pollar
 * patrocina el fee con un fee-bump, así que cuando la transacción interna falla
 * eso es lo único que llega. La causa real está en los códigos de operación, y
 * casi siempre es una de tres: no hay USDC, la wallet no acepta USDC todavía, o
 * la cuenta ni siquiera existe en la red.
 */
function mensajeDeCadena(resultado: {
  resultCode?: string;
  details?: string;
  message?: string;
  code?: string;
}): string {
  const texto = [resultado.resultCode, resultado.details, resultado.message, resultado.code]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (texto.includes('op_underfunded') || texto.includes('insufficient')) {
    return 'No tienes suficiente USDC en tu wallet para este trato.';
  }
  if (texto.includes('op_no_trust') || texto.includes('no_trust')) {
    return 'Tu wallet todavía no acepta USDC. Vuelve a entrar para que Pollar active el activo y reintenta.';
  }
  if (texto.includes('op_no_destination') || texto.includes('no_destination')) {
    return 'La cuenta de custodia no está activa en esta red. Avísanos: es un problema de configuración, no tuyo.';
  }
  if (texto.includes('tx_bad_auth') || texto.includes('bad_auth')) {
    return 'Tu wallet no pudo firmar el pago. Cierra sesión, vuelve a entrar e intenta otra vez.';
  }
  if (texto.includes('feebumpinnerfailed') || texto.includes('tx_failed')) {
    // El envolvente sin más pistas: lo más común es saldo insuficiente.
    return 'La red rechazó el pago. Lo más probable es que te falte USDC en la wallet; revisa tu saldo y reintenta.';
  }
  return resultado.message ?? resultado.details ?? 'La red rechazó el pago.';
}

/** El SDK devuelve algunos mensajes internos en inglés; nunca se muestran tal cual al usuario. */
function mensajePollar(mensaje?: string): string {
  const texto = mensaje?.trim() ?? '';
  const esConexion = /failed to fetch|unexpected error|network|load sign-in/i.test(texto);

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port !== '3000') {
    return 'Caserita debe abrirse en http://localhost:3000 para conectarse con Pollar. Cierra el otro servidor y vuelve a ejecutar npm run dev.';
  }
  if (esConexion) {
    return 'No pudimos conectar con Pollar. Revisa tu conexión e intenta iniciar sesión nuevamente.';
  }
  return texto || 'No pudimos iniciar sesión con Pollar. Intenta nuevamente.';
}

function ProveedorPollar({ children }: { children: ReactNode }) {
  const base = useBase();
  const setErrorBase = base.setError;
  const setOcupadoBase = base.setOcupado;
  const router = useRouter();
  const {
    login,
    isAuthenticated,
    verified,
    wallet,
    enabledAssets,
    setTrustline,
    refreshAssets,
    getClient,
    runTx,
    openTxHistoryModal,
    walletBalance,
    refreshWalletBalance,
  } = usePollar();
  const [esperandoLogin, setEsperandoLogin] = useState(false);
  const trustlineIntentada = useRef<string | null>(null);

  // `login()` inicia un flujo asíncrono y no devuelve una promesa. Escuchamos
  // su máquina de estados para no dejar la interfaz congelada si el popup se
  // bloquea, vence el tiempo o Pollar rechaza la autenticación.
  useEffect(() => {
    return getClient().onAuthStateChange((estado) => {
      if (estado.step !== 'error') return;
      setEsperandoLogin(false);
      setOcupadoBase(false);
      setErrorBase(mensajePollar(estado.message));
    });
  }, [getClient, setErrorBase, setOcupadoBase]);

  // Una cuenta patrocinada puede existir con 0 XLM, pero aun necesita aceptar
  // el USDC. Pollar decide en el servidor si la app cubre la reserva y el fee;
  // esta llamada nunca usa la clave de la custodia ni una seed del usuario.
  useEffect(() => {
    const asset = base.config?.asset;
    if (!base.usuario || !verified || !wallet?.address || !asset?.issuer) return;
    if (enabledAssets.step === 'idle') {
      void refreshAssets();
      return;
    }
    if (enabledAssets.step === 'error') {
      setErrorBase('Pollar no pudo leer los activos habilitados para esta wallet.');
      return;
    }
    if (enabledAssets.step !== 'loaded') return;
    if (!enabledAssets.data.exists) {
      setErrorBase(ERROR_WALLET_NO_ACTIVA);
      return;
    }
    if (base.error === ERROR_WALLET_NO_ACTIVA) setErrorBase(null);

    const existente = enabledAssets.data.assets.find(
      (item) => item.code === asset.code && item.issuer === asset.issuer,
    );
    if (existente?.trustlineEstablished) return;

    const clave = `${wallet.address}:${asset.code}:${asset.issuer}`;
    if (trustlineIntentada.current === clave) return;
    trustlineIntentada.current = clave;
    setOcupadoBase(true);

    void setTrustline({ code: asset.code, issuer: asset.issuer })
      .then(async (resultado) => {
        if (resultado.status === 'error') {
          throw new Error(resultado.details || 'Pollar no pudo crear la trustline.');
        }
        await refreshAssets();
      })
      .catch(() => {
        setErrorBase('Tu wallet existe, pero Pollar no pudo habilitar USDC. Revisa Tokens & Trustlines.');
      })
      .finally(() => setOcupadoBase(false));
  }, [
    base.config?.asset,
    base.error,
    base.usuario,
    enabledAssets,
    refreshAssets,
    setErrorBase,
    setOcupadoBase,
    setTrustline,
    verified,
    wallet?.address,
  ]);

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

    },
    [base, getClient],
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
    // Si la cookie propia venció pero Pollar conservó una sesión anterior, no
    // la reutilizamos silenciosamente. Se limpia primero para que el acceso
    // vuelva a pasar por el proveedor de identidad.
    if (isAuthenticated && wallet?.address) {
      base.setOcupado(true);
      try {
        await getClient().logout();
      } catch (e) {
        base.setError(mensajeDe(e));
        base.setOcupado(false);
        return;
      } finally {
        base.setOcupado(false);
      }
    }
    setEsperandoLogin(true);
    login({ provider: 'google' });
  }, [base, getClient, isAuthenticated, login, wallet?.address]);

  const salir = useCallback(async () => {
    base.setError(null);
    base.setOcupado(true);
    const [backend, pollar] = await Promise.allSettled([base.salir(), getClient().logout()]);
    base.setOcupado(false);
    router.replace('/');
    router.refresh();
    if (backend.status === 'rejected' || pollar.status === 'rejected') {
      base.setError('No pudimos cerrar por completo la sesión. Refresca e inténtalo otra vez.');
    }
  }, [base, getClient, router]);

  /**
   * El pago del comprador: un `payment` de USDC a la cuenta de custodia con el
   * memo del trato. Pollar patrocina el fee, asi que el comprador nunca ve XLM.
   */
  /**
   * Saldo USDC del usuario, leído del estado de Pollar.
   *
   * Sirve para avisar antes de firmar. Sin esto, una wallet sin USDC falla con
   * `txFeeBumpInnerFailed`, que no le dice nada a nadie: es el error de la
   * transacción envolvente, y la causa real queda escondida en la interna.
   */
  const saldoUsdc = useMemo(() => {
    const asset = base.config?.asset;
    if (!asset || walletBalance.step !== 'loaded') return null;
    const fila = walletBalance.data.balances.find((b) => b.code === asset.code);
    if (!fila) return '0';
    return fila.available ?? fila.balance ?? '0';
  }, [base.config?.asset, walletBalance]);

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
        throw new Error(mensajeDeCadena(resultado));
      }

      // El saldo cambió: que la próxima comprobación previa no use el viejo.
      void refreshWalletBalance().catch(() => undefined);
      return resultado.hash;
    },
    [base.config, refreshWalletBalance, runTx],
  );

  const refrescarSaldo = useCallback(async () => {
    await refreshWalletBalance().catch(() => undefined);
  }, [refreshWalletBalance]);

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
      saldoUsdc,
      refrescarSaldo,
      refrescar: base.refrescar,
    }),
    [base, entrar, esperandoLogin, openTxHistoryModal, pagar, refrescarSaldo, saldoUsdc, salir],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

function ProveedorMock({ children }: { children: ReactNode }) {
  const base = useBase();
  const router = useRouter();

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

  const salir = useCallback(async () => {
    base.setError(null);
    base.setOcupado(true);
    try {
      await base.salir();
      window.localStorage.removeItem(CLAVE_MOCK);
      router.replace('/');
      router.refresh();
    } catch (e) {
      base.setError(mensajeDe(e));
    } finally {
      base.setOcupado(false);
    }
  }, [base, router]);

  const valor: EstadoSesion = useMemo(
    () => ({
      usuario: base.usuario,
      config: base.config,
      cargando: base.cargando,
      ocupado: base.ocupado,
      error: base.error,
      modoMock: true,
      entrar,
      salir,
      pagar,
      abrirHistorial: null,
      saldoUsdc: null,
      refrescarSaldo: async () => undefined,
      refrescar: base.refrescar,
    }),
    [base, entrar, pagar, salir],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
