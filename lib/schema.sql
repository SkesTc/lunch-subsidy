-- 台中市第2區免費營養午餐核銷系統 資料庫結構
-- 在 Supabase SQL Editor 執行此檔案

-- 1. 學校資料表（90校）
create table if not exists schools (
  id serial primary key,
  code integer unique not null,           -- 編號 1-90
  district text not null,                 -- 區別
  name text not null,                     -- 學校名稱
  approved_total bigint not null,         -- 核定金額
  sem1_amount bigint not null,            -- 第1學期核定
  sem2_amount bigint not null,            -- 第2學期核定（可由承辦更新）
  created_at timestamptz default now()
);

-- 2. 使用者資料表
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  school_id integer references schools(id),
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 3. 銀行帳戶資料表（第1、2學期各一筆）
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references schools(id),
  semester integer not null check (semester in (1, 2)),
  bank_name text not null default '',          -- 銀行名稱
  branch_name text not null default '',        -- 分行名稱
  bank_code text not null default '',          -- 金融機構代碼（7碼）
  account_name text not null default '',       -- 帳戶戶名
  account_number text not null default '',     -- 帳號
  contact_name text not null default '',       -- 聯絡人
  contact_phone text not null default '',      -- 聯絡電話
  is_preloaded boolean default false,          -- 是否為承辦預載
  is_modified boolean default false,           -- 各校是否有修改
  confirmed_at timestamptz,
  confirmed_by text,                           -- 確認者 email
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, semester)
);

-- 4. 收支結算表
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references schools(id),
  semester integer not null check (semester in (1, 2)),
  personnel_expense bigint not null default 0,   -- 人事費(D)
  business_expense bigint not null default 0,    -- 業務費(D)
  equipment_expense bigint not null default 0,   -- 設備及投資(D)
  total_expense bigint not null default 0,       -- 實支總額
  surplus bigint not null default 0,             -- 結餘款(E=A-D)
  repay_amount bigint not null default 0,        -- 應繳回(F=E×C，無條件進位)
  scan_file_path text,                           -- 掃描結算表路徑
  scan_uploaded_at timestamptz,
  remittance_file_path text,                     -- 送款憑單（第2學期）
  remittance_date date,
  status text not null default 'draft' check (status in ('draft','downloaded','uploaded')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, semester)
);

-- 5. 操作日誌
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  school_id integer references schools(id),
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

-- Storage bucket 設定（在 Supabase Dashboard > Storage 建立）
-- Bucket 名稱：settlement-files
-- 路徑格式：{school_code}/{semester}/{filename}

-- RLS Policies（簡化版，正式上線前請依需求調整）
alter table schools enable row level security;
alter table user_profiles enable row level security;
alter table bank_accounts enable row level security;
alter table settlements enable row level security;
alter table activity_logs enable row level security;

-- 所有人可讀學校資料
create policy "schools_read" on schools for select using (true);

-- 使用者只能讀自己的 profile（管理員可讀全部）
create policy "profiles_self" on user_profiles for select
  using (email = current_user or is_admin = true);

-- 帳戶資料：各校只能讀/寫自己的，管理員全部
create policy "bank_school_access" on bank_accounts for all
  using (
    school_id = (select school_id from user_profiles where email = current_user)
    or
    (select is_admin from user_profiles where email = current_user)
  );

-- 結算表：各校只能讀/寫自己的，管理員全部
create policy "settlement_school_access" on settlements for all
  using (
    school_id = (select school_id from user_profiles where email = current_user)
    or
    (select is_admin from user_profiles where email = current_user)
  );
