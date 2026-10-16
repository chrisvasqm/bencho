CREATE TABLE "run_points" (
	"run_id" uuid NOT NULL,
	"second" integer NOT NULL,
	"virtual_users" integer NOT NULL,
	"requests_per_second" integer NOT NULL,
	"error_rate" double precision NOT NULL,
	"p50" double precision,
	"p90" double precision,
	"p95" double precision,
	"p99" double precision,
	CONSTRAINT "run_points_run_id_second_pk" PRIMARY KEY("run_id","second")
);
--> statement-breakpoint
ALTER TABLE "run_points" ADD CONSTRAINT "run_points_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;