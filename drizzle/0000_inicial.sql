CREATE TYPE "public"."estado_trato" AS ENUM('BORRADOR', 'PUBLICADO', 'FINANCIADO', 'LIBERANDO', 'LIBERADO', 'DEVOLVIENDO', 'DEVUELTO', 'EXPIRADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."motivo_devolucion" AS ENUM('PLAZO_VENCIDO', 'ACORDADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('TRATO_CREADO', 'DEPOSITO_DETECTADO', 'DEPOSITO_RECHAZADO', 'CODIGO_INTENTO_FALLIDO', 'CODIGO_BLOQUEADO', 'LIBERACION_INICIADA', 'LIBERACION_COMPLETADA', 'LIBERACION_FALLIDA', 'DEVOLUCION_INICIADA', 'DEVOLUCION_COMPLETADA', 'DEVOLUCION_FALLIDA', 'TRATO_CANCELADO', 'TRATO_EXPIRADO', 'WEBHOOK_RECIBIDO');--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" varchar(64) PRIMARY KEY NOT NULL,
	"usado_en" timestamp with time zone,
	"expira_en" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"trato_id" varchar(16) NOT NULL,
	"tipo" "tipo_evento" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_addr" varchar(56),
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tratos" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"vendedor_id" varchar(24) NOT NULL,
	"comprador_id" varchar(24),
	"titulo" varchar(80) NOT NULL,
	"descripcion" varchar(500),
	"lugar_entrega" varchar(120),
	"monto_usdc" numeric(20, 7) NOT NULL,
	"monto_bs_referencia" numeric(20, 2),
	"tipo_cambio_bs" numeric(10, 4),
	"estado" "estado_trato" DEFAULT 'PUBLICADO' NOT NULL,
	"codigo_hash" varchar(80) NOT NULL,
	"codigo_cifrado" varchar(200) NOT NULL,
	"codigo_intentos" integer DEFAULT 0 NOT NULL,
	"codigo_bloqueado" boolean DEFAULT false NOT NULL,
	"escrow_address" varchar(56) NOT NULL,
	"memo" varchar(28) NOT NULL,
	"comprador_address" varchar(56),
	"vendedor_address" varchar(56) NOT NULL,
	"tx_deposito" varchar(64),
	"tx_liberacion" varchar(64),
	"tx_devolucion" varchar(64),
	"motivo_devolucion" "motivo_devolucion",
	"expira_en" timestamp with time zone NOT NULL,
	"financiado_en" timestamp with time zone,
	"libera_hasta" timestamp with time zone,
	"cerrado_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tratos_memo_unique" UNIQUE("memo"),
	CONSTRAINT "tratos_tx_deposito_unique" UNIQUE("tx_deposito"),
	CONSTRAINT "tratos_tx_liberacion_unique" UNIQUE("tx_liberacion"),
	CONSTRAINT "tratos_tx_devolucion_unique" UNIQUE("tx_devolucion")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"wallet_address" varchar(56) NOT NULL,
	"pollar_user_id" varchar(64),
	"nombre" varchar(80),
	"telefono" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_trato_id_tratos_id_fk" FOREIGN KEY ("trato_id") REFERENCES "public"."tratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratos" ADD CONSTRAINT "tratos_vendedor_id_users_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tratos" ADD CONSTRAINT "tratos_comprador_id_users_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_nonces_expira_idx" ON "auth_nonces" USING btree ("expira_en");--> statement-breakpoint
CREATE INDEX "eventos_trato_idx" ON "eventos" USING btree ("trato_id","created_at");--> statement-breakpoint
CREATE INDEX "tratos_vendedor_idx" ON "tratos" USING btree ("vendedor_id","created_at");--> statement-breakpoint
CREATE INDEX "tratos_comprador_idx" ON "tratos" USING btree ("comprador_id","created_at");--> statement-breakpoint
CREATE INDEX "tratos_vencimiento_idx" ON "tratos" USING btree ("estado","libera_hasta");--> statement-breakpoint
CREATE INDEX "tratos_expiracion_idx" ON "tratos" USING btree ("estado","expira_en");