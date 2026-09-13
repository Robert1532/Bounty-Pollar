ALTER TABLE "users" ADD COLUMN "avatar_ruta" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_tipo" varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_actualizado_en" timestamp with time zone;