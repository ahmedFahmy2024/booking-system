-- B3.1 cinema catalogue and scheduling (D3). New tables are empty, so their
-- NOT NULL columns need no backfill. bookings.showtime_id is added NULLABLE:
-- prototype rows stay valid and B4 owns populating it. Drafts may have no
-- layout_snapshot; B3.3 writes the immutable snapshot on publish.
CREATE TABLE "auditoriums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"synopsis" text NOT NULL,
	"poster_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "films_duration_minutes_positive" CHECK ("films"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auditorium_id" uuid NOT NULL,
	"row_label" text NOT NULL,
	"seat_number" integer NOT NULL,
	"aisle_after" boolean DEFAULT false NOT NULL,
	"is_out_of_service" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seats_seat_number_positive" CHECK ("seats"."seat_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "showtimes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"auditorium_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"price_piastres" integer DEFAULT 0 NOT NULL,
	"layout_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showtimes_price_piastres_non_negative" CHECK ("showtimes"."price_piastres" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "showtime_id" uuid;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_auditorium_id_auditoriums_id_fk" FOREIGN KEY ("auditorium_id") REFERENCES "public"."auditoriums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtimes" ADD CONSTRAINT "showtimes_auditorium_id_auditoriums_id_fk" FOREIGN KEY ("auditorium_id") REFERENCES "public"."auditoriums"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auditoriums_name_unique" ON "auditoriums" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "seats_auditorium_row_number_unique" ON "seats" USING btree ("auditorium_id","row_label","seat_number");--> statement-breakpoint
CREATE INDEX "seats_auditorium_id_idx" ON "seats" USING btree ("auditorium_id");--> statement-breakpoint
CREATE INDEX "showtimes_film_starts_at_idx" ON "showtimes" USING btree ("film_id","starts_at");--> statement-breakpoint
CREATE INDEX "showtimes_auditorium_starts_at_idx" ON "showtimes" USING btree ("auditorium_id","starts_at");--> statement-breakpoint
CREATE INDEX "showtimes_status_idx" ON "showtimes" USING btree ("status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_showtime_id_showtimes_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtimes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_showtime_id_idx" ON "bookings" USING btree ("showtime_id");