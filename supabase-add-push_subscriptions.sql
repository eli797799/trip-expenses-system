-- ============================================================
-- הוספת טבלת push_subscriptions – מנויים להתראות (Web Push)
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ
-- ============================================================
-- טבלה חדשה בלבד – לא משנה נתונים קיימים
-- ============================================================

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
-- סיום – הטבלה push_subscriptions מוכנה
-- ============================================================
