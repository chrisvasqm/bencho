ALTER TABLE "run_points" ADD COLUMN "iterations_per_second" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "run_points" ADD COLUMN "dropped_per_second" integer DEFAULT 0 NOT NULL;