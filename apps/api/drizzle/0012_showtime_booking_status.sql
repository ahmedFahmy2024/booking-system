-- B5.4 (D5): a booking may only claim seats on a published showtime. The
-- confirmation route reads status before it writes; a cancellation that
-- commits inside that window must still win. A plain re-read in the handler
-- cannot close the window under READ COMMITTED, so Postgres is the arbiter:
-- the trigger locks the showtime row with FOR SHARE, which waits for an
-- in-flight cancellation and then re-reads its committed status. This makes
-- every booking write serialize on the showtime row with cancellation, and
-- rolls back the whole Neon batch when the showtime was cancelled.
CREATE OR REPLACE FUNCTION reject_booking_for_unpublished_showtime()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status text;
BEGIN
  -- Prototype rows predate cinema showtimes and keep a NULL showtime_id.
  IF NEW.showtime_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO current_status
  FROM showtimes
  WHERE id = NEW.showtime_id
  FOR SHARE;

  IF current_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'showtime_not_published',
      CONSTRAINT = 'showtimes_booking_requires_published';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_require_published_showtime
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION reject_booking_for_unpublished_showtime();
