/**
 * Reconstruye los contadores de reputación desde la tabla `tratos`.
 *
 *   npx tsx scripts/recalcular-reputacion.ts
 *
 * Los contadores son una caché, no la verdad: la verdad son los tratos cerrados
 * y sus transacciones en la red. Esto lo demuestra y los deja consistentes si
 * alguna vez quedan desalineados (una migración, un restore, un bug).
 */
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env se usan las variables del shell. No es un error.
}

async function main() {
  const { recalcularReputacion } = await import('../src/lib/tratos/reputacion');
  const { getSql } = await import('../src/db');

  const resultado = await recalcularReputacion();
  console.log(`\nReputación recalculada para ${resultado.usuarios} usuarios.\n`);
  await getSql().end({ timeout: 5 });
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
