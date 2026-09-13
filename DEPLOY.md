# Deploy en Vercel

Guía para dejar Caserita en línea con el plan gratuito (Hobby).

---

## 1. Antes de tocar Vercel

Creá un archivo `.npmrc` en la raíz del proyecto (al lado de `package.json`) con
una sola línea:

```
legacy-peer-deps=true
```

Sin eso el `npm install` de Vercel falla por un conflicto de peers de vitest.
Commiteá el archivo y subí todo a GitHub.

---

## 2. Build and Output Settings

En Vercel, al importar el repo, dejá **todo en automático**. Next.js se detecta
solo y los valores correctos son los que ya trae:

| Campo | Valor |
|---|---|
| Framework Preset | **Next.js** |
| Root Directory | `./` |
| Build Command | `next build` *(automático)* |
| Output Directory | *(vacío — lo maneja Next)* |
| Install Command | `npm install` *(automático)* |
| Node.js Version | **20.x** o superior |

No hace falta override de nada. Si el instalador te falla igual, poné
`npm install --legacy-peer-deps` como Install Command.

---

## 3. Environment Variables

En **Settings → Environment Variables**, marcadas para Production, Preview y
Development.

### Obligatorias — sin estas la app no arranca

| Variable | Qué poner |
|---|---|
| `DATABASE_URL` | La cadena de **Connection Pooling** de Supabase (puerto `6543`), no la directa del `5432`. Supabase la da en Settings → Database → Connection string → Transaction pooler. |
| `APP_URL` | La URL https que te da Vercel, sin barra final. Ej: `https://caserita.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | La misma URL. |
| `SESSION_SECRET` | 32+ caracteres al azar. Generá uno nuevo con:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `CRON_SECRET` | 16+ caracteres al azar. Mismo comando. |
| `ESCROW_SECRET_KEY` | La clave secreta de la cuenta de custodia (`S...`). Sale de `npm run escrow:generar`. **Nunca la pongas con prefijo `NEXT_PUBLIC_`.** |
| `USDC_ISSUER` | El emisor de USDC (`G...`). En testnet: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | Tu publishable key de Pollar. |

### De red — poné las dos iguales, o se rompe el explorador de transacciones

| Variable | Valor |
|---|---|
| `STELLAR_NETWORK` | `testnet` o `mainnet` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | lo mismo que la de arriba |

### Para la evidencia de entrega (opcional, pero la foto no aparece sin ellas)

| Variable | Qué poner |
|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | La service role key. Es de servidor, **nunca** `NEXT_PUBLIC_`. |
| `SUPABASE_BUCKET_EVIDENCIAS` | `evidencias` (es el valor por defecto) |

### Con valor por defecto — solo si querés cambiar algo

| Variable | Default |
|---|---|
| `USDC_CODE` | `USDC` |
| `MONTO_MAXIMO_USDC` | `50` |
| `MONTO_MINIMO_USDC` | `0.1` |
| `HORAS_PARA_ENTREGAR` | `48` |
| `DIAS_VIGENCIA_TRATO` | `7` |
| `TIPO_CAMBIO_BS` | `6.96` |
| `DB_POOL_MAX` | `5` |
| `HORIZON_URL` | se deduce de `STELLAR_NETWORK` |
| `POLLAR_WEBHOOK_SECRET` | opcional, para el webhook con HMAC |

### Las que NO van

`MODO_MOCK` y `NEXT_PUBLIC_MODO_MOCK` — dejalas fuera. Si `MODO_MOCK=true` llega
a producción, la app se niega a arrancar a propósito.

---

## 4. El cron de vencimientos

`vercel.json` pide el cron cada 15 minutos, pero **el plan Hobby solo permite
una ejecución diaria**. Vercel no te va a rechazar el deploy: simplemente lo
corre una vez al día, y las devoluciones automáticas se atrasan.

Dos salidas:

- **Para la demo del buildathon**, dejalo así y disparalo a mano cuando lo
  necesites:
  ```
  curl -H "Authorization: Bearer TU_CRON_SECRET" https://tu-app.vercel.app/api/cron/vencimientos
  ```
- **Para que corra de verdad cada 15 minutos**, creá una cuenta gratis en
  [cron-job.org](https://cron-job.org), apuntá a esa misma URL con la cabecera
  `Authorization: Bearer TU_CRON_SECRET`, y cambiá `vercel.json` a
  `"schedule": "0 6 * * *"` para que Vercel no duplique el trabajo.

---

## 5. Después del primer deploy

1. Corré las migraciones en el **SQL Editor de Supabase**, en este orden y una
   vez cada una: `supabase/schema.sql`, luego
   `supabase/002_reputacion_y_evidencia.sql`, luego
   `supabase/003_calificaciones.sql`.
2. Abrí `https://tu-app.vercel.app/api/salud`. Te dice si la cuenta de custodia
   existe, si acepta USDC, si la base responde y cuánto tarda. Si algo está mal,
   ahí sale con nombre y apellido.
3. Revisá que `latenciaBaseMs` esté por debajo de 500 ms. Si te da varios
   segundos, estás usando la conexión directa en vez del pooler.

---

## Errores que te vas a encontrar

**`Module not found: @fontsource-variable/...`** → falta el `npm install`, o el
`.npmrc` con `legacy-peer-deps=true`.

**`Variables de entorno inválidas`** en el log de Vercel → el mensaje lista
exactamente cuáles faltan. La app se niega a arrancar a propósito: es preferible
un error claro en el deploy que un `undefined` firmando una transacción.

**`APP_URL debe ser https en produccion`** → dejaste el `http://localhost:3000`.

**La app anda pero se cuelga en cada consulta** → `DATABASE_URL` apunta al puerto
`5432` (conexión directa) en vez del `6543` (pooler). En serverless cada función
abre su propia conexión y la directa se satura.
