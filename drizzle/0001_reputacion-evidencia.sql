ALTER TYPE "public"."tipo_evento" ADD VALUE 'EVIDENCIA_ADJUNTADA';--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "evidencia_ruta" varchar(200);--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "evidencia_tipo" varchar(40);--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "evidencia_bytes" integer;--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "evidencia_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "evidencia_subida_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ventas_completadas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "compras_completadas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "devoluciones_como_vendedor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "devoluciones_como_comprador" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "volumen_vendido_usdc" numeric(20, 7) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "primer_trato_en" timestamp with time zone;