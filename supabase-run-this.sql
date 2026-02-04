-- ============================================================
-- הרץ את הקובץ המלא הזה ב-Supabase: SQL Editor → New query → הדבק והרץ
-- ============================================================
-- בטוח להרצה – לא מוחק נתונים, רק מוסיף מה שחסר
-- אפשר להריץ שוב – לא יגרום לשגיאות (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- 1. עמודות בטבלת trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS view_code text;

-- 2. עמודה בטבלת participants (ימי טיול לכל משתתף – פר-ראטה)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS days_in_trip integer;

-- 3. טבלת push_subscriptions – מנויים להתראות (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_trip_id ON push_subscriptions(trip_id);

-- ============================================================
-- סיום – הכל מוכן
-- ============================================================
