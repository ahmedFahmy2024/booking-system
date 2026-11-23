-- B2.4 guest links. Existing prototype rows get a unique opaque reference from
-- the column default (Postgres evaluates it once per row during ADD COLUMN).
-- The three guest-link columns stay NULL: those rows have no active link until
-- a staff resend issues the first credential. B3 must derive the expiry from
-- the showtime's start instant instead of bookings.starts_at.
ALTER TABLE "bookings" ADD COLUMN "reference" text DEFAULT 'bkg_' || replace(gen_random_uuid()::text, '-', '') NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_link_verifier" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_link_encrypted" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_link_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reference_unique" UNIQUE("reference");