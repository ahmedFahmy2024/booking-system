-- Custom SQL migration file, put your code below! --

-- Application guards are a fast path; the invariant must also survive two
-- concurrent deactivations, which READ COMMITTED snapshots cannot prevent.
-- Enforce it at the storage boundary (D1, permission matrix last-admin rule).
CREATE TABLE IF NOT EXISTS staff_admin_guard (
  locked boolean PRIMARY KEY DEFAULT true
);
INSERT INTO staff_admin_guard (locked) VALUES (true) ON CONFLICT (locked) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  other_active_admins integer;
BEGIN
  -- Serialise the check with concurrent deactivations/promotions. Each
  -- PL/pgSQL statement after this lock sees a fresh READ COMMITTED snapshot.
  PERFORM 1 FROM staff_admin_guard WHERE locked FOR UPDATE;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' AND COALESCE(OLD.banned, false) = false THEN
      SELECT count(*) INTO other_active_admins
      FROM "user"
      WHERE role = 'admin' AND COALESCE(banned, false) = false AND id <> OLD.id;

      IF other_active_admins < 1 THEN
        RAISE EXCEPTION 'last_active_admin' USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.banned IS DISTINCT FROM OLD.banned THEN
    IF OLD.role = 'admin' AND COALESCE(OLD.banned, false) = false
       AND (NEW.role IS DISTINCT FROM 'admin' OR COALESCE(NEW.banned, false) = true) THEN
      SELECT count(*) INTO other_active_admins
      FROM "user"
      WHERE role = 'admin' AND COALESCE(banned, false) = false AND id <> OLD.id;

      IF other_active_admins < 1 THEN
        RAISE EXCEPTION 'last_active_admin' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_enforce_last_active_admin ON "user";
CREATE TRIGGER user_enforce_last_active_admin
BEFORE UPDATE OR DELETE ON "user"
FOR EACH ROW EXECUTE FUNCTION enforce_last_active_admin();
