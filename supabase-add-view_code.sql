-- הוסף עמודת קוד צפייה (להגבלת צפייה בסכומים) – Supabase
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ

ALTER TABLE trips
ADD COLUMN IF NOT EXISTS view_code text;
