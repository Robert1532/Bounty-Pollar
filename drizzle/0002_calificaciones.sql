ALTER TYPE "public"."tipo_evento" ADD VALUE 'CALIFICACION_RECIBIDA';--> statement-breakpoint
CREATE TABLE "calificaciones" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"trato_id" varchar(16) NOT NULL,
	"vendedor_id" varchar(24) NOT NULL,
	"estrellas" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calificaciones_trato_id_unique" UNIQUE("trato_id"),
	CONSTRAINT "calificaciones_rango" CHECK ("calificaciones"."estrellas" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calificaciones_recibidas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suma_estrellas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_trato_id_tratos_id_fk" FOREIGN KEY ("trato_id") REFERENCES "public"."tratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_vendedor_id_users_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calificaciones_vendedor_idx" ON "calificaciones" USING btree ("vendedor_id","created_at");