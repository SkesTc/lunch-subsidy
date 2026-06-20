-- 修改申請機制 Migration
-- 在 Supabase SQL Editor 執行

-- 1. 新增 change_requests 表
CREATE TABLE IF NOT EXISTS change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  school_year TEXT NOT NULL,
  semester INTEGER,
  request_type TEXT NOT NULL CHECK (request_type IN ('amount_modify', 'scan_reupload', 'remittance_reupload')),
  new_amount BIGINT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

-- 2. settlements 新增三欄位
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS amount_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS scan_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS remittance_reupload_allowed BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. RLS（使用 supabaseAdmin 所以可略，但保持一致）
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "change_requests_all" ON change_requests FOR ALL USING (true);
