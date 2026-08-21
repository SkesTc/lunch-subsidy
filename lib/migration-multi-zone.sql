-- ═══════════════════════════════════════════════════════════
--  多區多計畫 Migration SQL
--  在測試環境 Supabase SQL Editor 執行（完整建立）
--  正式環境只需執行「Stage 1 加欄位」部分
-- ═══════════════════════════════════════════════════════════

-- ══════════════════════════════════════
--  現有資料表（原封不動）
-- ══════════════════════════════════════

create table if not exists schools (
  id serial primary key,
  code integer unique not null,
  district text not null,
  name text not null,
  approved_total bigint not null default 0,
  sem1_amount bigint not null default 0,
  sem2_amount bigint not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  school_id integer references schools(id),
  is_admin boolean default false,
  created_at timestamptz default now()
);

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references schools(id),
  semester integer not null check (semester in (1, 2)),
  bank_name text not null default '',
  branch_name text not null default '',
  bank_code text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  is_preloaded boolean default false,
  is_modified boolean default false,
  confirmed_at timestamptz,
  confirmed_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, semester)
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references schools(id),
  semester integer not null check (semester in (1, 2)),
  personnel_expense bigint not null default 0,
  business_expense bigint not null default 0,
  equipment_expense bigint not null default 0,
  total_expense bigint not null default 0,
  surplus bigint not null default 0,
  repay_amount bigint not null default 0,
  scan_file_path text,
  scan_uploaded_at timestamptz,
  remittance_file_path text,
  remittance_date date,
  status text not null default 'draft' check (status in ('draft','downloaded','uploaded')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(school_id, semester)
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  school_id integer references schools(id),
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════
--  新增：多區多計畫架構
-- ══════════════════════════════════════

-- 1. 區別資料表
create table if not exists zones (
  id serial primary key,
  name text not null,                    -- 例：台中市第2區
  host_school text not null default '',  -- 承辦學校名稱
  host_email text not null default '',   -- 承辦學校聯絡信箱
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 插入預設區別（4個區）
insert into zones (id, name, host_school) values
  (1, '台中市第1區', ''),
  (2, '台中市第2區', '臺中市神岡區社口國民小學'),
  (3, '台中市第3區', ''),
  (4, '台中市第4區', '')
on conflict (id) do nothing;

-- 2. 計畫資料表
create table if not exists plans (
  id serial primary key,
  zone_id integer not null references zones(id),
  name text not null,                    -- 例：免費營養午餐核銷
  plan_type text not null default 'lunch', -- lunch / afterschool / other
  school_year text not null default '',  -- 學年度
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 插入預設計畫（第2區午餐）
insert into plans (id, zone_id, name, plan_type, school_year) values
  (1, 2, '免費營養午餐核銷', 'lunch', '113')
on conflict (id) do nothing;

-- 3. 區別設定表（取代單一 settings.json，各區獨立設定）
create table if not exists zone_settings (
  id serial primary key,
  zone_id integer not null references zones(id),
  plan_id integer references plans(id),  -- null 表示區層級設定，有值表示計畫層級設定
  key text not null,
  value text not null default '',
  updated_at timestamptz default now(),
  unique(zone_id, plan_id, key)
);

-- 插入第2區預設設定（從現有 settings.json 遷移）
insert into zone_settings (zone_id, plan_id, key, value) values
  (2, null, 'system_name', '台中市第2區免費營養午餐核銷系統'),
  (2, null, 'host_school', '臺中市神岡區社口國民小學'),
  (2, null, 'admin_name', ''),
  (2, null, 'admin_title', ''),
  (2, null, 'admin_phone', ''),
  (2, null, 'gas_url', ''),
  (2, null, 'gas_secret', ''),
  (2, null, 'drive_folder_id', ''),
  (2, 1,   'school_year', '113'),
  (2, 1,   'block1_deadline', ''),
  (2, 1,   'block2_deadline', ''),
  (2, 1,   'block3_deadline', '')
on conflict (zone_id, plan_id, key) do nothing;

-- ══════════════════════════════════════
--  Stage 1：現有資料表加欄位
--  （正式環境執行這段即可，不會中斷服務）
-- ══════════════════════════════════════

-- schools 加 zone_id（預設第2區，現有資料不受影響）
alter table schools
  add column if not exists zone_id integer references zones(id) default 2;

-- user_profiles 加 zone_id 和 role
alter table user_profiles
  add column if not exists zone_id integer references zones(id) default 2,
  add column if not exists role text not null default 'school'
    check (role in ('super_admin', 'zone_admin', 'school'));

-- 現有管理員升級為 zone_admin
update user_profiles set role = 'zone_admin', zone_id = 2 where is_admin = true;

-- ══════════════════════════════════════
--  RLS Policies
-- ══════════════════════════════════════

alter table schools enable row level security;
alter table user_profiles enable row level security;
alter table bank_accounts enable row level security;
alter table settlements enable row level security;
alter table activity_logs enable row level security;
alter table zones enable row level security;
alter table plans enable row level security;
alter table zone_settings enable row level security;

-- 所有人可讀學校、區別、計畫資料
create policy "schools_read" on schools for select using (true);
create policy "zones_read" on zones for select using (true);
create policy "plans_read" on plans for select using (true);
create policy "zone_settings_read" on zone_settings for select using (true);

-- user_profiles
create policy "profiles_self" on user_profiles for select
  using (email = current_user or is_admin = true);

-- bank_accounts
create policy "bank_school_access" on bank_accounts for all
  using (
    school_id = (select school_id from user_profiles where email = current_user)
    or
    (select is_admin from user_profiles where email = current_user)
  );

-- settlements
create policy "settlement_school_access" on settlements for all
  using (
    school_id = (select school_id from user_profiles where email = current_user)
    or
    (select is_admin from user_profiles where email = current_user)
  );

-- Storage bucket：settlement-files（在 Supabase Dashboard > Storage 手動建立）
