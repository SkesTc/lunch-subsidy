-- ══════════════════════════════════════════════════════════════
-- 正式站 Migration（方案 A）
-- 適用：lunch.skes.tc.edu.tw（同 Supabase 專案 Schema 升級）
-- 確認資料：schools=91, user_profiles=96, plans=5(uuid), settlements=0, bank_accounts=90
-- zones / zone_settings 在正式站尚未建立，此腳本完整處理
-- 全部語法為 IF NOT EXISTS / DO $$ 安全冪等，可重複執行
-- ══════════════════════════════════════════════════════════════

-- ── STEP 1：建立 zones 表（必須最先，其他表有外鍵依賴）──────────
CREATE TABLE IF NOT EXISTS zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  host_school TEXT DEFAULT '',
  host_email TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='zones' AND policyname='zones_all') THEN
    CREATE POLICY "zones_all" ON zones FOR ALL USING (true);
  END IF;
END $$;

-- ── STEP 2：建立 zone_settings 表 ────────────────────────────
CREATE TABLE IF NOT EXISTS zone_settings (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER REFERENCES zones(id) ON DELETE CASCADE,
  plan_id TEXT,
  key TEXT NOT NULL,
  value TEXT
);

ALTER TABLE zone_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='zone_settings' AND policyname='zone_settings_all') THEN
    CREATE POLICY "zone_settings_all" ON zone_settings FOR ALL USING (true);
  END IF;
END $$;

-- zone_settings 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS zone_settings_null_plan_idx
  ON zone_settings (zone_id, key) WHERE plan_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS zone_settings_with_plan_idx
  ON zone_settings (zone_id, plan_id, key) WHERE plan_id IS NOT NULL;

-- ── STEP 3：schools 新增欄位 ──────────────────────────────────
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id);

-- ── STEP 4：user_profiles 新增欄位 ───────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'school';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_title TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';

-- ── STEP 5：bank_accounts 新增欄位 ───────────────────────────
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS school_year TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT false;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- ── STEP 6：settlements 新增欄位 ─────────────────────────────
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS school_year TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS amount_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS scan_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS remittance_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS scan_file_path TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS remittance_file_path TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS remittance_date TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS business_expense NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS surplus NUMERIC DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS repay_amount NUMERIC DEFAULT 0;

-- settlements unique constraint 調整（允許同學校同學期多計畫）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='settlements' AND constraint_type='UNIQUE'
    AND constraint_name='settlements_school_id_semester_key'
  ) THEN
    ALTER TABLE settlements DROP CONSTRAINT settlements_school_id_semester_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS settlements_unique_idx
  ON settlements (school_id, semester, school_year, COALESCE(plan_id::text, 'NULL'));

-- ── STEP 7：plans 新增欄位 ───────────────────────────────────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS require_repay BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS deduct_s1_repay BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS deadline TEXT DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS open_note TEXT DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS zone_ids INTEGER[];
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS school_year TEXT DEFAULT '113';

-- ── STEP 8：建立 plan_amounts 表 ─────────────────────────────
CREATE TABLE IF NOT EXISTS plan_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL DEFAULT '113',
  semester INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_amounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plan_amounts' AND policyname='plan_amounts_all') THEN
    CREATE POLICY "plan_amounts_all" ON plan_amounts FOR ALL USING (true);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS plan_amounts_unique_idx
  ON plan_amounts (school_id, plan_id, school_year, COALESCE(semester, 0));

-- ── STEP 9：建立 change_requests 表 ──────────────────────────
CREATE TABLE IF NOT EXISTS change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  school_year TEXT NOT NULL,
  semester INTEGER,
  request_type TEXT NOT NULL,
  new_amount BIGINT,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  plan_id UUID REFERENCES plans(id),
  pending_file_path TEXT,
  new_info JSONB
);

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='change_requests' AND policyname='change_requests_all') THEN
    CREATE POLICY "change_requests_all" ON change_requests FOR ALL USING (true);
  END IF;
END $$;

-- ── STEP 10：建立 login_logs 表 ──────────────────────────────
CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  is_admin BOOLEAN DEFAULT FALSE,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='login_logs' AND policyname='login_logs_all') THEN
    CREATE POLICY "login_logs_all" ON login_logs FOR ALL USING (true);
  END IF;
END $$;

-- ── STEP 11：建立 school_amounts 表 ──────────────────────────
CREATE TABLE IF NOT EXISTS school_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  school_year TEXT NOT NULL,
  sem1_amount NUMERIC DEFAULT 0,
  sem2_amount NUMERIC DEFAULT 0,
  approved_total NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, school_year)
);

ALTER TABLE school_amounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='school_amounts' AND policyname='school_amounts_all') THEN
    CREATE POLICY "school_amounts_all" ON school_amounts FOR ALL USING (true);
  END IF;
END $$;

-- ── STEP 12：初始資料設定 ─────────────────────────────────────
-- 現有管理員設為 super_admin
UPDATE user_profiles
SET role = 'super_admin'
WHERE is_admin = true AND (role IS NULL OR role = 'school');

-- 其餘帳號設為 school
UPDATE user_profiles
SET role = 'school'
WHERE role IS NULL;

-- ── 確認查詢（執行完畢後用來驗證）────────────────────────────
-- SELECT role, count(*) FROM user_profiles GROUP BY role;
-- SELECT count(*) FROM zones;
-- SELECT count(*) FROM plan_amounts;
-- SELECT count(*) FROM login_logs;
-- SELECT count(*) FROM school_amounts;
