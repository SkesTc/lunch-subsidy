-- 計畫送件狀態：未開放 not_open／已開放 open／已結案 closed（取代單純的 is_open 開關）
alter table public.plans add column if not exists status text not null default 'not_open';

-- 依現有開關帶入：開放中 → 已開放，關閉 → 未開放（已結束的計畫請再到後台改成「已結案」）
update public.plans set status = case when is_open then 'open' else 'not_open' end
where status = 'not_open' and is_open;

do $$ begin
  alter table public.plans add constraint plans_status_check check (status in ('not_open', 'open', 'closed'));
exception when duplicate_object then null; end $$;
