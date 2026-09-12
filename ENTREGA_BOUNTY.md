# Entrega — Bounty Pollar Buildathon Cochabamba 2026

Completar los campos entre corchetes y enviar este bloque por el grupo de Telegram antes del cierre.

## Datos

- **Proyecto:** Caserita
- **Equipo:** [nombre del equipo]
- **Integrantes:** [nombres completos]
- **Repositorio público:** https://github.com/Robert1532/Bounty-Pollar
- **Aplicación:** [URL pública]
- **Video (máximo 3 minutos):** [URL del video] o “demo en vivo”
- **Hash de la transacción mainnet mediante Pollar:** [hash y enlace de Stellar Expert]
- **Cuenta Vaquita para recibir el premio:** [cuenta]

## Descripción (menos de 300 palabras)

Caserita es una custodia de pagos para ventas que nacen en Facebook Marketplace y WhatsApp. Resuelve el punto muerto cotidiano entre personas que no se conocen: el vendedor no quiere entregar sin cobrar y el comprador no quiere pagar antes de recibir.

El vendedor entra con Google mediante Pollar, crea un trato en bolivianos o USDC y comparte un enlace o QR. El comprador entra también con Pollar y paga USDC desde la wallet que la plataforma administra, sin instalar extensiones, guardar una frase semilla ni conseguir XLM. Caserita verifica el depósito directamente en Stellar —activo, emisor, monto exacto, destino, memo y remitente— y mantiene el dinero en una cuenta de custodia.

Después de recibir el producto, el comprador muestra un código de seis dígitos. El vendedor lo ingresa y la custodia libera el pago. Si no hay entrega dentro de 48 horas, el dinero puede volver automáticamente a la dirección que realmente pagó. Cada depósito, liberación y devolución conserva su hash público; las transiciones financieras son idempotentes y recuperan resultados ambiguos consultando Horizon antes de volver a enviar.

La prueba completa en testnet usó dos usuarios Pollar distintos: 8 USDC pasaron del comprador a la custodia y luego al vendedor, con saldo final cero para ese trato en el escrow.

## Evidencia testnet

- Depósito de 8 USDC: https://stellar.expert/explorer/testnet/tx/09bcf9973b9773315834483088afa01b9d2fb4c6cda25b0902625c8b9b405441
- Liberación de 8 USDC: https://stellar.expert/explorer/testnet/tx/24dcb30df2bf31e4b68e02fac6abe17169a3a877dcb8a9c37f629bf8c04e4437

## Ensayo del video

1. Problema y usuario objetivo — 25 segundos.
2. Login Pollar, creación y link/QR — 30 segundos.
3. Pago del comprador y depósito verificable — 40 segundos.
4. Código, entrega y liberación — 35 segundos.
5. Comprobantes, seguridad y devolución por plazo — 25 segundos.
6. Potencial y roadmap Soroban — 25 segundos.

Duración objetivo: **2 minutos 40 segundos**, dejando 20 segundos de margen.
