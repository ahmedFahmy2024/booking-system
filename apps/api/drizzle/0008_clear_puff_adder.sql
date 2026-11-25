ALTER TABLE "bookings" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "idempotency_fingerprint" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "idempotency_response" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_key_unique" ON "bookings" USING btree ("idempotency_key");