ALTER TYPE "public"."tipo_evento" ADD VALUE 'PROBLEMA_REPORTADO';--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "reporte_motivo" varchar(32);--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "reporte_detalle" varchar(500);--> statement-breakpoint
ALTER TABLE "tratos" ADD COLUMN "reportado_en" timestamp with time zone;