-- ══════════════════════════════════════════════════════════════
-- 完整 Migration：測試環境補齊所有欄位
-- 在 Supabase 測試專案 SQL Editor 執行
-- ══════════════════════════════════════════════════════════════

-- ── 1. schools ────────────────────────────────────────────────
ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id) DEFAULT 2;

-- ── 2. user_profiles ─────────────────────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_title TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'school';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id);

-- ── 3. bank_accounts ─────────────────────────────────────────
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS school_year TEXT;

-- ── 4. settlements ────────────────────────────────────────────
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS school_year TEXT;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS amount_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS scan_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS remittance_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;

-- settlements unique 改為允許同一學校同學期多計畫
-- 先移除舊的 unique constraint（名稱依實際環境而定）
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

-- 新的 unique：同學校 + 同學期 + 同計畫 + 同學年（plan_id NULL 表示舊式非計畫模式）
CREATE UNIQUE INDEX IF NOT EXISTS settlements_unique_idx
  ON settlements (school_id, semester, school_year, COALESCE(plan_id::text, 'NULL'));

-- ── 5. plans ─────────────────────────────────────────────────
-- 注意：測試環境的 plans 可能是 serial pk（multi-zone migration）
-- 但程式碼期望 UUID pk。若 plans 已存在且為 serial，需重建。
-- 以下只補欄位（假設已是 UUID pk 或為新建）

ALTER TABLE plans ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS require_repay BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS deduct_s1_repay BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS deadline TEXT DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS open_note TEXT DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS zone_id INTEGER REFERENCES zones(id);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS zone_ids INTEGER[];

-- ── 6. plan_amounts ──────────────────────────────────────────
ALTER TABLE plan_amounts ADD COLUMN IF NOT EXISTS semester INTEGER;

-- 更新 unique constraint（加 semester）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='plan_amounts' AND constraint_type='UNIQUE'
    AND constraint_name='plan_amounts_school_id_plan_id_school_year_key'
  ) THEN
    ALTER TABLE plan_amounts DROP CONSTRAINT plan_amounts_school_id_plan_id_school_year_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS plan_amounts_unique_idx
  ON plan_amounts (school_id, plan_id, school_year, COALESCE(semester, 0));

-- ── 7. change_requests ───────────────────────────────────────
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
  reviewed_by TEXT
);

ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS pending_file_path TEXT;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS new_info JSONB;

-- 移除舊的 request_type CHECK constraint（舊版缺少 scan_upload / remittance_upload）
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT constraint_name INTO con_name
  FROM information_schema.table_constraints
  WHERE table_name='change_requests' AND constraint_type='CHECK'
    AND constraint_name LIKE '%request_type%'
  LIMIT 1;
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE change_requests DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;
END $$;

ALTER TABLE change_requests ADD CONSTRAINT change_requests_request_type_check
  CHECK (request_type IN ('amount_modify','scan_upload','remittance_upload','scan_reupload','remittance_reupload'));

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='change_requests' AND policyname='change_requests_all'
  ) THEN
    CREATE POLICY "change_requests_all" ON change_requests FOR ALL USING (true);
  END IF;
END $$;

-- ── 8. login_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  school_id INTEGER REFERENCES schools(id),
  is_admin BOOLEAN DEFAULT FALSE,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 9. school_amounts ────────────────────────────────────────
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

-- ── 10. RLS 補強 ─────────────────────────────────────────────
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_amounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='login_logs' AND policyname='login_logs_all') THEN
    CREATE POLICY "login_logs_all" ON login_logs FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='school_amounts' AND policyname='school_amounts_all') THEN
    CREATE POLICY "school_amounts_all" ON school_amounts FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='plan_amounts' AND policyname='plan_amounts_all') THEN
    CREATE POLICY "plan_amounts_all" ON plan_amounts FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='zone_settings' AND policyname='zone_settings_all') THEN
    CREATE POLICY "zone_settings_all" ON zone_settings FOR ALL USING (true);
  END IF;
END $$;

-- ── 11. zone_settings.plan_id 改為 TEXT（UUID 相容）────────────
-- plans 已改為 UUID pk，zone_settings.plan_id 需跟著改
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='zone_settings' AND column_name='plan_id' AND data_type='integer'
  ) THEN
    ALTER TABLE zone_settings DROP CONSTRAINT IF EXISTS zone_settings_plan_id_fkey;
    ALTER TABLE zone_settings ALTER COLUMN plan_id TYPE TEXT USING plan_id::text;
  END IF;
END $$;

-- ── 12. login_logs 統一欄位名稱 ───────────────────────────────
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id);
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
-- created_at 已在 CREATE TABLE 時定義，此處為舊環境補強
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='login_logs' AND column_name='created_at'
  ) THEN
    ALTER TABLE login_logs ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ── 13. zone_settings NULL plan_id 唯一索引修正 ───────────────
ALTER TABLE zone_settings DROP CONSTRAINT IF EXISTS zone_settings_zone_id_plan_id_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS zone_settings_null_plan_idx
  ON zone_settings (zone_id, key) WHERE plan_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS zone_settings_with_plan_idx
  ON zone_settings (zone_id, plan_id, key) WHERE plan_id IS NOT NULL;
