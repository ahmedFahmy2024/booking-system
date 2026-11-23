-- B3.3 (D3): an auditorium is occupied for [starts_at, occupancy_ends_at),
-- where the application writes occupancy_ends_at as film duration plus the
-- 15-minute turnaround. A normal read-then-write check cannot stop two
-- simultaneous publishes from both winning under READ COMMITTED, so Postgres
-- is the arbiter: the exclusion constraint is evaluated by every INSERT and
-- UPDATE, regardless of how many app instances are writing.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- btree_gist supplies the uuid equality operator class needed to combine a
-- per-auditorium key with the half-open time range in one GiST index. Cancelled
-- showtimes release the auditorium and keep their history, so they are excluded
-- from the constraint's predicate. Two showtimes in different auditoriums never
-- conflict because their auditorium_id values differ.
ALTER TABLE "showtimes"
ADD CONSTRAINT "showtimes_no_overlap"
EXCLUDE USING gist (
  "auditorium_id" WITH =,
  tstzrange("starts_at", "occupancy_ends_at", '[)') WITH &&
)
WHERE ("status" <> 'cancelled');
