-- 全年計畫可依學期分開設定送件狀態：{"1": "closed", "2": "open"}
alter table public.plans add column if not exists semester_status jsonb not null default '{}'::jsonb;

-- 現有全年計畫兩學期先沿用目前狀態
update public.plans set semester_status = jsonb_build_object('1', status, '2', status)
where semester is null and semester_status = '{}'::jsonb;
