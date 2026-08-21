-- ══════════════════════════════════════════════
-- 核銷計畫（plans）資料表
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year  text NOT NULL,
  name         text NOT NULL,          -- 計畫名稱，例：免費午餐補助
  label        text NOT NULL,          -- 短標籤，例：午餐S1（用於表格欄位）
  semester     integer,               -- 1=第1學期 / 2=第2學期 / null=全年
  require_repay boolean DEFAULT false, -- 是否需繳回賸餘款
  sort_order   integer DEFAULT 0,
  is_active    boolean DEFAULT true,
  deadline     text DEFAULT '',        -- 截止日期說明文字
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_school_year_idx ON plans(school_year);

-- ══════════════════════════════════════════════
-- 各學校各計畫核定金額
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plan_amounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   integer NOT NULL REFERENCES schools(id),
  plan_id     uuid NOT NULL REFERENCES plans(id),
  school_year text NOT NULL,
  amount      numeric DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(school_id, plan_id, school_year)
);

CREATE INDEX IF NOT EXISTS plan_amounts_plan_idx ON plan_amounts(plan_id, school_year);
CREATE INDEX IF NOT EXISTS plan_amounts_school_idx ON plan_amounts(school_id, school_year);

-- ══════════════════════════════════════════════
-- settlements 加 plan_id（漸進式遷移）
-- ══════════════════════════════════════════════
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id);
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id);
