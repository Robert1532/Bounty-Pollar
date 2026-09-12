/**
 * Muestra el saldo de la cuenta de custodia.
 *
 *   npx tsx scripts/estado-escrow.ts
 *
 * Sirve para dos cosas: revisar antes del demo que hay XLM para los fees, y
 * cuadrar que el USDC retenido coincide con los tratos en custodia.
 */
import { Horizon, Keypair, Networks } from '@stellar/stellar-sdk';

const red = (process.env.STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON =
  process.env.HORIZON_URL ?? (red === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org');

async function main() {
  const secreto = process.env.ESCROW_SECRET_KEY;
  if (!secreto) throw new Error('Falta ESCROW_SECRET_KEY');

  const par = Keypair.fromSecret(secreto);
  const cuenta = await new Horizon.Server(HORIZON).loadAccount(par.publicKey());

  console.log(`\nCuenta de custodia (${red}): ${par.publicKey()}`);
  console.log(`Passphrase: ${red === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET}\n`);
  for (const saldo of cuenta.balances) {
    const codigo = saldo.asset_type === 'native' ? 'XLM' : ('asset_code' in saldo ? saldo.asset_code : '?');
    console.log(`  ${codigo.padEnd(6)} ${saldo.balance}`);
  }
  console.log('');
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
