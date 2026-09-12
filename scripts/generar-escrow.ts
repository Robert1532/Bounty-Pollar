/**
 * Genera la cuenta de custodia de Caserita.
 *
 *   npx tsx scripts/generar-escrow.ts
 *
 * En testnet la crea, la fondea con Friendbot y le abre la trustline de USDC.
 * En mainnet solo genera el par: fondearla es una decision con plata real y no
 * la toma un script.
 */
/**
 * Carga el .env del proyecto. `tsx` no lo hace solo, y sin esto el script no ve
 * ESCROW_SECRET_KEY ni STELLAR_NETWORK.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env se usan las variables del shell. No es un error.
}

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const red = (process.env.STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const esMainnet = red === 'mainnet';

const HORIZON = process.env.HORIZON_URL ?? (esMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');
const PASSPHRASE = esMainnet ? Networks.PUBLIC : Networks.TESTNET;

// Emisores oficiales de Circle.
const USDC_POR_DEFECTO = esMainnet
  ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
  : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

async function main() {
  const emisor = process.env.USDC_ISSUER ?? USDC_POR_DEFECTO;
  const par = Keypair.random();

  console.log('\n=== Cuenta de custodia de Caserita ===');
  console.log(`Red:      ${red}`);
  console.log(`Publica:  ${par.publicKey()}`);
  console.log(`Secreta:  ${par.secret()}`);
  console.log('\nGuarda la secreta en ESCROW_SECRET_KEY y no la subas a git.\n');

  if (esMainnet) {
    console.log('Mainnet: fondea esta cuenta con al menos 2.5 XLM y corre el script de trustline.');
    console.log(`USDC_ISSUER=${emisor}\n`);
    return;
  }

  const servidor = new Horizon.Server(HORIZON);

  console.log('Fondeando con Friendbot…');
  const respuesta = await fetch(`https://friendbot.stellar.org?addr=${par.publicKey()}`);
  if (!respuesta.ok) throw new Error(`Friendbot respondio ${respuesta.status}`);

  console.log('Abriendo la trustline de USDC…');
  const cuenta = await servidor.loadAccount(par.publicKey());
  const tx = new TransactionBuilder(cuenta, { fee: String(Number(BASE_FEE) * 10), networkPassphrase: PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: new Asset('USDC', emisor) }))
    .setTimeout(60)
    .build();
  tx.sign(par);
  const enviada = await servidor.submitTransaction(tx);

  console.log(`\nListo. Trustline: ${enviada.hash}`);
  console.log('\nPega esto en tu .env:\n');
  console.log(`STELLAR_NETWORK=${red}`);
  console.log(`ESCROW_SECRET_KEY=${par.secret()}`);
  console.log(`USDC_ISSUER=${emisor}\n`);
}

main().catch((error) => {
  console.error('\nFallo la creacion de la cuenta:', error instanceof Error ? error.message : error);
  process.exit(1);
});
