-- 全域設定改存資料表（取代 Storage 的 __system/settings.json）
-- 每個設定一列，存檔時只更新有變動的列，避免多人同時儲存互相覆蓋
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 啟用 RLS 且不建立任何 policy：只有伺服器端（service role）能讀寫，前端金鑰無法存取（設定內含 GAS 金鑰）
alter table public.system_settings enable row level security;
