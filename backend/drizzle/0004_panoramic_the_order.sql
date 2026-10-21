ALTER TABLE "runs" ADD COLUMN "mode" text DEFAULT 'users' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "max_virtual_users" integer;