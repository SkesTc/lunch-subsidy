-- 確保 user_profiles 有聯絡人欄位
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS contact_phone text;
