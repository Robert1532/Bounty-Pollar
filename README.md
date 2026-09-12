# Caserita

**Plata en custodia para ventas por Facebook Marketplace y WhatsApp.**
El comprador paga y el dinero queda retenido. El vendedor cobra recién cuando entrega y el comprador le muestra un código de 6 dígitos. Si no hay entrega en 48 horas, la plata vuelve sola.

Ninguna de las dos partes instala una wallet, ve una frase semilla ni necesita XLM: entran con Google y **Pollar** se encarga del resto.

> Bounty Pollar · Buildathon Cochabamba 2026 · Ethereum Bolivia

| | |
|---|---|
| **Demo pública** | _(completar con la URL de Vercel)_ |
| **Video** | _(completar)_ |
| **Transacción en mainnet** | _(completar con el hash y el link a stellar.expert)_ |
| **Red** | Stellar · USDC |

---

## El problema

En Bolivia el comercio informal digital vive en Facebook Marketplace, grupos de WhatsApp y TikTok, y siempre se traba en el mismo punto muerto: el vendedor no manda sin cobrar y el comprador no paga sin recibir.

Hoy hay tres salidas y las tres son malas. Encontrarse en la plaza con efectivo hace que la mitad de las ventas se caigan por logística. Pagar por adelantado con QR pone todo el riesgo en el comprador, y el banco no revierte una transferencia voluntaria entre personas. Mandar el producto contra entrega pone todo el riesgo en el vendedor. Encima está la estafa del comprobante editado, tan común que ya cambió el comportamiento de la gente: muchos vendedores exigen ver el saldo en la app del banco antes de entregar.

Caserita no compite con Marketplace: se monta encima. La conversación sigue ocurriendo en WhatsApp; lo único que cambia es que la plata pasa por una custodia con reglas.

---

## Cómo funciona

```
                  ┌──────────── el vendedor crea el trato ────────────┐
                  │  título, monto (en Bs o USDC), lugar de entrega   │
                  └───────────────────────┬──────────────────────────┘
                                          │  link corto + QR
                                          ▼
                            se manda por WhatsApp (wa.me)
                                          │
                                          ▼
   el comprador entra con Google ──► paga USDC ──► CUENTA DE CUSTODIA
   (Pollar le crea la wallet)        runTx()       memo = CAS-<id>
                                          │
                     el backend verifica el depósito EN LA RED
                                          │
                                          ▼
                                    ┌───────────┐
                                    │ FINANCIADO│  el comprador ve su código
                                    └─────┬─────┘  de 6 dígitos
                         ┌────────────────┴────────────────┐
            entrega +    │                                 │  48 h sin entrega
            código ok    ▼                                 ▼  (Vercel Cron)
                    ┌──────────┐                      ┌──────────┐
                    │ LIBERADO │ → paga al vendedor   │ DEVUELTO │ → vuelve al
                    └──────────┘                      └──────────┘   comprador
```

### Máquina de estados

```
BORRADOR
   │ publicar
   ▼
PUBLICADO ─── 7 días sin comprador ──────────────► EXPIRADO
   │       └─ el vendedor cancela ───────────────► CANCELADO
   │ depósito confirmado on-chain
   ▼
FINANCIADO ──► LIBERANDO ──► LIBERADO      (pago al vendedor)
   │      └──► DEVOLVIENDO ──► DEVUELTO    (pago de vuelta al comprador)
   │                                        motivo: PLAZO_VENCIDO | ACORDADA
   └─ 48 h sin liberación ─► el cron dispara la devolución
```

`LIBERANDO` y `DEVOLVIENDO` existen a propósito: son el candado que impide que dos peticiones simultáneas manden el mismo dinero dos veces. Se entra a ellos con un `UPDATE` condicionado al estado esperado, y recién después se toca la red. Si la red rechaza, el trato vuelve a `FINANCIADO` y se puede reintentar.

**No hay estado `EN_DISPUTA`.** El plazo de 48 horas *es* el sistema de disputas de la v1, y lo decimos en voz alta en vez de improvisar un árbitro que no existe.

---

## Cómo integramos Pollar

Esta es la sección que pide el bounty. Cada punto de integración con el archivo donde vive.

| Qué | Dónde | Para qué |
|---|---|---|
| `PollarProvider` | `src/app/providers.tsx` | Envuelve la app con la publishable key y la red (`testnet` / `mainnet`). |
| `usePollar().login({ provider: 'google' })` | `src/app/providers.tsx` → `ProveedorPollar.entrar()` | El corazón del producto: una vendedora de La Cancha entra con Google y ya tiene wallet. |
| `usePollar().wallet` | `src/app/providers.tsx`, `src/components/Encabezado.tsx` | La dirección `G…` es la identidad del usuario en Caserita. No guardamos contraseñas. |
| `client.stellar.sep53.signMessage()` | `src/app/providers.tsx` → `abrirSesion()` | **Prueba de propiedad de la wallet.** Ver [Autenticación](#autenticación-el-backend-no-le-cree-al-navegador). |
| `usePollar().runTx('payment', …, { memo })` | `src/app/providers.tsx` → `pagar()`, usado por `src/components/PagarTrato.tsx` | El pago del comprador a la cuenta de custodia, con el memo que identifica el trato. Fee patrocinado: el comprador nunca ve XLM. |
| `usePollar().openTxHistoryModal()` | `src/app/page.tsx` | "Ver mis movimientos en Stellar": el historial de Pollar como comprobante que hoy nadie tiene. |
| `POST /v1/wallets/fund` (server API) | `src/app/api/pollar/activar/route.ts` | Activación de la wallet en funding mode **Deferred**, desde una ruta de API con `x-pollar-api-key`. La clave secreta jamás llega al navegador. |
| Funding mode **Immediate** | Dashboard → Treasury | Recomendado para Caserita: el comprador tiene que poder pagar en un tap. |
| Tokens & Trustlines (USDC) | Dashboard → Treasury | Pollar abre la trustline de USDC al crear la wallet; la app nunca emite un `change_trust`. |
| Sponsorship de fees | Dashboard → Treasury → Sponsorship | Innegociable: si el comprador tuviera que conseguir XLM, el producto está muerto. |
| Transaction Policy | Dashboard | Tope de fee máximo y restricción de operaciones sensibles. |

### Autenticación: el backend no le cree al navegador

Pollar autentica al usuario **en el cliente**. Eso deja una pregunta abierta que muchas integraciones resuelven mal: cuando el navegador le dice al backend *"soy `GABC…`"*, ¿por qué habría de creerle? Si el backend acepta la dirección que le mandan, cualquiera puede reclamar la wallet de cualquiera.

Caserita lo resuelve con una prueba criptográfica, sin secreto compartido:

1. `POST /api/auth/nonce` — el servidor emite un nonce de un solo uso con vencimiento y arma el mensaje exacto a firmar (dominio + red + nonce + fecha). `src/app/api/auth/nonce/route.ts`
2. El cliente llama a `client.stellar.sep53.signMessage(mensaje)`. Las wallets custodiadas firman del lado de Pollar; las externas, con su adapter.
3. `POST /api/auth/sesion` — el servidor quema el nonce (`UPDATE … WHERE usado_en IS NULL`), verifica la firma ed25519 contra `SHA-256("Stellar Signed Message:\n" + mensaje)` con la llave pública reclamada, y recién ahí emite la cookie de sesión. `src/lib/sep53.ts`, `src/app/api/auth/sesion/route.ts`

Una firma capturada no sirve dos veces, ni en otro dominio, ni en la otra red. Los tests de esto están en `tests/sep53.test.ts`.

### Lo que la documentación marca como "coming soon" y no usamos

- **Passkeys / Face ID.** `@pollar/core` expone `loginSmartWallet()` y el slot de configuración, y `@pollar/react` trae `browserPasskeyCeremony`, pero lo dejamos fuera del camino crítico. El login social ya resuelve el problema de onboarding y no queríamos apostar el demo a una superficie todavía en movimiento.
- **SEP-7 en el QR.** El link de pago es nuestra propia URL (`/t/<id>`), no un URI SEP-7 con monto y memo pre-llenados. El QR de `CompartirTrato` codifica esa URL.
- **Ramp SEP-24 / entrada en bolivianos.** No la prometemos como funcionalidad viva. Hoy la conversión la resuelve la red de caseros de USDT que ya opera en Bolivia; el ramp de Pollar es el siguiente paso del roadmap.
- **Webhooks.** En el Operator Guide aparecen como *upcoming*. La máquina de estados está diseñada para funcionar con **polling + cron**, y el webhook es una mejora enchufable: `src/app/api/webhooks/pollar/route.ts` verifica HMAC y, si llega, solo **adelanta** una confirmación que igual se haría sola. Nunca es la fuente de verdad.

---

## El modelo de custodia, dicho con todas las letras

**La v1 usa custodia gestionada por la aplicación.** Una sola cuenta Stellar de la app recibe todos los depósitos, y cada trato se identifica por su `memo` (`CAS-<id>`). La liberación y la devolución las firma el backend con la clave de esa cuenta.

Por qué así y no con un contrato Soroban: el SDK de Pollar firma desde la wallet **del usuario logueado**. Para mover fondos desde una cuenta de la aplicación hace falta una llave que la app controle, y eso es exactamente lo que hace `src/lib/stellar/horizon.ts` con `@stellar/stellar-sdk`. Elegimos entregar un producto usable en 48 horas antes que un contrato a medio compilar.

Lo que **sí** es verificable por cualquiera, hoy:

- El depósito existe en la red, con su monto y su remitente. No hay "captura de pantalla" que valga.
- La liberación y la devolución son transacciones públicas con hash, visibles en stellar.expert desde la propia pantalla del trato.
- Cada transición queda en la tabla `eventos` con su payload.

Lo que **no** es cierto y no lo vamos a decir: que esto sea *trustless*. Mientras la llave de la custodia sea de la app, el usuario confía en la app. El contrato Soroban es el primer ítem del roadmap, y el SDK ya soporta `invoke_contract` en `/tx/build`, así que el camino está abierto.

**Alternativas descartadas:** wallet por trato (cada una necesita ~1.5 XLM de reserva y una trustline antes de poder cobrar: lento y caro para montos de 20 USD) y contrato Soroban (riesgo alto para el plazo del buildathon).

---

## Seguridad

Lo que el jurado va a mirar, y dónde está:

| Decisión | Dónde |
|---|---|
| **El monto y el remitente se verifican on-chain**, nunca se confía en el cliente. Un trato pasa a `FINANCIADO` solo tras encontrar el depósito real en Horizon con el memo y el monto correctos. | `src/lib/stellar/horizon.ts` → `buscarDeposito()` |
| El **código de entrega** se guarda con bcrypt para verificar, y cifrado con AES-256-GCM para poder volver a mostrárselo al comprador. La clave sale del entorno, nunca de la base. | `src/lib/codigo.ts`, `src/lib/cripto.ts` |
| **5 intentos** y el trato se bloquea. El contador está en la base, no en memoria: reiniciar el server no lo resetea. | `src/lib/tratos/service.ts` → `liberar()` |
| El código solo lo ve el **comprador autenticado**, por un endpoint aparte, sin caché y con rate limit. Nunca viaja en la vista del trato. | `src/app/api/tratos/[id]/codigo/route.ts` |
| **Toda transición es idempotente** y usa `UPDATE … WHERE estado = <esperado>`: dos toques al botón no pagan dos veces. | `src/lib/tratos/service.ts` |
| El hash de la transacción se **registra antes de enviarla**: si el envío se corta por timeout, se puede averiguar si entró en vez de pagar de nuevo. | `src/lib/stellar/horizon.ts` → `enviarDesdeEscrow()` |
| **Log de auditoría** de todo: creación, depósito, intentos fallidos, bloqueos, liberaciones y devoluciones. | tabla `eventos`, `src/lib/eventos.ts` |
| Las **claves secretas** (Pollar y la custodia) viven solo en rutas de servidor. La validación de entorno falla al arrancar si falta alguna. | `src/lib/env.ts` |
| **Modo demo prohibido en producción**: `MODO_MOCK=true` con `NODE_ENV=production` hace que la app no levante. | `src/lib/env.ts` |
| **Sesión** en cookie `__Host-` HttpOnly, SameSite=Lax, JWT HS256 de 12 h. | `src/lib/session.ts` |
| **CSRF** por chequeo de origen en toda mutación, además de SameSite. | `src/lib/http.ts` → `verificarOrigen()` |
| **Cabeceras**: CSP, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Permissions-Policy. | `src/middleware.ts` |
| **Rate limiting** por IP y por usuario en login, creación, confirmación y liberación. | `src/lib/rate-limit.ts` |
| **Validación con Zod** de absolutamente toda entrada externa, con `.strict()`. | `src/lib/validaciones.ts` |
| **Dinero en enteros**: los montos se comparan en stroops (`bigint`), nunca en `float`. | `src/lib/money.ts` |
| **Tope de 50 USDC por trato** en la v1. Decisión de producto para un prototipo. | `MONTO_MAXIMO_USDC` |
| El cron está protegido con un secreto comparado en **tiempo constante**. | `src/app/api/cron/vencimientos/route.ts` |
| Los logs **redactan** códigos, firmas, tokens y cookies. | `src/lib/logger.ts` |

### Límites conocidos

- El rate limiter es **en memoria**: con varias instancias en Vercel cada una lleva su propia cuenta. Los límites que de verdad protegen plata (los 5 intentos del código) están en la base y no tienen ese problema. Para producción: Redis o Upstash.
- La devolución automática depende de que el cron corra. Si Vercel Cron se cae, la plata no se pierde —queda en la custodia y el barrido la procesa en la siguiente corrida.
- No hay reintento automático si Horizon rechaza una liberación: el trato vuelve a `FINANCIADO` y el vendedor puede intentar de nuevo.

---

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript en modo estricto
- **PostgreSQL** + **Drizzle ORM** (migraciones versionadas en `drizzle/`)
- **@pollar/react** y **@pollar/core** 0.11.x
- **@stellar/stellar-sdk** 17 para verificar en Horizon y firmar desde la custodia
- **Tailwind CSS 4**, móvil primero
- **Vitest** para la lógica que no puede fallar

```
src/
├── app/
│   ├── page.tsx                      Mis tratos: "vendo" y "compro"
│   ├── nuevo/page.tsx                Crear trato
│   ├── t/[id]/page.tsx               Página pública del trato: pagar, estado, código
│   ├── t/[id]/entregar/page.tsx      El vendedor ingresa los 6 dígitos
│   ├── providers.tsx                 PollarProvider + sesión (real y demo)
│   └── api/
│       ├── auth/{nonce,sesion,yo}    Login con prueba SEP-53
│       ├── tratos/…                  Crear, confirmar, liberar, devolver, cancelar, código
│       ├── cron/vencimientos         Barrido cada 15 minutos
│       ├── pollar/activar            POST /v1/wallets/fund (funding mode Deferred)
│       ├── webhooks/pollar           Eventos de Pollar con HMAC (opcional)
│       └── mock/…                    Solo en modo demo
├── db/schema.ts                      Esquema Postgres
├── lib/
│   ├── stellar/                      Horizon, custodia, simulación
│   ├── tratos/                       Máquina de estados y lógica de negocio
│   ├── sep53.ts  codigo.ts  cripto.ts  money.ts  session.ts  rate-limit.ts
│   └── env.ts                        Configuración validada con Zod
└── middleware.ts                     Cabeceras de seguridad
```

---

## Correrlo localmente

```bash
git clone <este-repo> && cd Bounty-Pollar
npm install
cp .env.example .env
```

### Opción rápida: modo demo, sin claves

Para ver el flujo completo sin cuenta de Pollar ni cuenta Stellar:

```bash
docker compose up -d          # Postgres local
npm run db:push               # crea las tablas
# en .env:  MODO_MOCK="true"  y  NEXT_PUBLIC_MODO_MOCK="true"
npm run dev
```

El login y la cadena se simulan, pero **recorren el mismo código**: las mismas transiciones, las mismas validaciones, el mismo log de auditoría. Abre la app en dos navegadores (uno normal y uno de incógnito) para ser vendedor y comprador a la vez.

### Con Pollar de verdad

1. Llena el formulario de acceso a mainnet en la página de Pollar. **Esto primero que todo.**
2. En el Dashboard de Pollar: crea la app, copia la publishable key y la secret key, activa **Google** como proveedor, configura **USDC** en Treasury → Tokens & Trustlines, deja funding mode en **Immediate** y activa **Sponsorship** de fees.
3. Crea la cuenta de custodia:

   ```bash
   npm run escrow:generar          # testnet: la crea, la fondea y abre la trustline
   npm run escrow:estado           # revisa saldos antes del demo
   ```

4. Completa `.env` con lo que imprimió el script y las claves de Pollar, pon `MODO_MOCK="false"` y corre `npm run db:push && npm run dev`.

### Comandos

```bash
npm run dev          # desarrollo
npm run build        # build de producción
npm run typecheck    # tsc --noEmit
npm run lint
npm run test         # 36 tests de la lógica crítica
npm run db:push      # esquema directo (desarrollo)
npm run db:generate  # genera la migración SQL
npm run db:migrate   # aplica migraciones (producción)
```

---

## Deploy en Vercel

1. Importa el repo. El build es `npm run build`.
2. Base de datos: Neon o Supabase. `DATABASE_URL` con el pooler y `DIRECT_URL` con la conexión directa (esta última solo para migraciones).
3. Variables de entorno: todas las de `.env.example`. `APP_URL` y `NEXT_PUBLIC_APP_URL` con el dominio real y **https**.
4. `vercel.json` ya deja configurado el cron de `/api/cron/vencimientos` cada 15 minutos. Vercel manda el header `Authorization: Bearer $CRON_SECRET`.
5. Aplica las migraciones: `npm run db:migrate`.

Antes del demo, la lista de siempre: `npm run escrow:estado` para confirmar que la custodia tiene XLM para los fees, probar desde tres celulares distintos y uno con datos móviles, no con el wifi del evento.

---

## Roadmap

1. **Contrato Soroban para la custodia.** `depositar`, `liberar(hash_codigo)`, `devolver_por_plazo`, respaldado con Auth Policy (allowlist de Soroban en Treasury). El SDK ya soporta `invoke_contract`.
2. **Entrada en bolivianos** vía el ramp de Pollar cuando salga de coming soon.
3. **Reputación portable.** Es el activo real: cada trato cumplido construye un historial verificable que hoy muere con la cuenta de Facebook del vendedor.
4. **Passkeys** cuando el hook esté exportado. El slot ya está previsto.
5. **Notificaciones** más allá de los enlaces `wa.me`.
6. **Comisión del 1%** sobre el monto en custodia, pagada por el vendedor: la mitad de lo que cobra cualquier pasarela, y le cierra ventas que hoy pierde.

---

## Lo que esta versión no hace, y lo decimos nosotros primero

- Sistema de disputas con árbitros. El timeout es la v1.
- Calificaciones con estrellas y perfiles públicos.
- Catálogo, búsqueda o feed. Caserita se monta sobre Marketplace, no lo reemplaza.
- App nativa, multi-moneda, multi-idioma, panel de administración.
- Chat interno. La conversación ya ocurre en WhatsApp y ahí se queda.
- Cubrir el caso de la caja vacía. Ese riesgo existe igual que con el efectivo. Lo que Caserita elimina es la estafa mucho más común: que una de las dos partes simplemente desaparezca.

---

## Licencia

MIT.
