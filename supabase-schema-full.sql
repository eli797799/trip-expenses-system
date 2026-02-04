-- ============================================================
-- סכמת טבלאות מלאה למערכת ניהול הוצאות טיול (Supabase / PostgreSQL)
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ
-- ============================================================
-- אזהרה: אם יש לך כבר נתונים וצריך רק להוסיף עמודות חסרות,
-- דלג על ה-DROP והרץ רק את בלוק "הוספת עמודות חסרות" בתחתית הקובץ.
-- ============================================================

-- מחיקת טבלאות קיימות (רק אם אתה רוצה להתחיל מאפס – מאבד נתונים!)
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS trips;

-- ----------------------------------------
-- טבלת טיולים
-- ----------------------------------------
CREATE TABLE trips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code   text UNIQUE NOT NULL,
  name        text NOT NULL,
  start_date  date,
  end_date    date,
  view_code   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- טבלת משתתפים
-- ----------------------------------------
CREATE TABLE participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       uuid,
  name          text NOT NULL,
  nickname      text,
  is_admin      boolean NOT NULL DEFAULT false,
  days_in_trip  integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_participants_trip_id ON participants(trip_id);

-- ----------------------------------------
-- טבלת תשלומים
-- ----------------------------------------
CREATE TABLE payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL,
  paid_by_id  uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  description text,
  note        text,
  paid_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_trip_id ON payments(trip_id);
CREATE INDEX idx_payments_paid_by_id ON payments(paid_by_id);

-- ----------------------------------------
-- הרשאות (Row Level Security) – אם אתה משתמש ב-RLS ב-Supabase
-- אפשר להפעיל אחר כך לפי הצורך.
-- ----------------------------------------
-- ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- סיום – אחרי הרצה הטבלאות trips, participants, payments מוכנות
-- ============================================================

-- ============================================================
-- אופציה: רק הוספת עמודות חסרות (בלי למחוק טבלאות או נתונים)
-- הרץ את הבלוק הזה בלבד אם כבר יש לך טבלאות ורק חסרות עמודות
-- (למשל start_date או end_date בטבלת trips)
-- ============================================================
/*
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS view_code text;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS days_in_trip integer;
*/
