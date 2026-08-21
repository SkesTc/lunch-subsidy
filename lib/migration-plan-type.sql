-- ══════════════════════════════════════════════
-- plan_amounts 加 semester 欄位（支援全學年計畫）
-- ══════════════════════════════════════════════

-- 加 semester 欄位（預設1，向後相容）
ALTER TABLE plan_amounts ADD COLUMN IF NOT EXISTS semester integer NOT NULL DEFAULT 1;

-- 重建唯一約束（加入 semester）
ALTER TABLE plan_amounts DROP CONSTRAINT IF EXISTS plan_amounts_school_id_plan_id_school_year_key;
ALTER TABLE plan_amounts DROP CONSTRAINT IF EXISTS plan_amounts_unique;
ALTER TABLE plan_amounts ADD CONSTRAINT plan_amounts_unique UNIQUE(school_id, plan_id, school_year, semester);
