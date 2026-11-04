-- ============================================================================
-- 운영 기능: 변경 이력 · 주간 보고 확정 · 업무 수정시각
--  - audit_logs: 트리거로 자동 기록 (누가 · 언제 · 무엇을 바꿨는지)
--  - weekly_reports: 주차별 최종 확정본(스냅샷). 확정본은 수정 불가, 관리자만 확정/해제
--  - tasks.updated_at: 수정 시 자동 갱신 (제출 현황 · 배포/취합 충돌 판단 기준)
-- ============================================================================

-- 1. tasks.updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- 2. 주간 보고 확정본
create table if not exists public.weekly_reports (
  week_start date primary key,
  snapshot jsonb not null,
  confirmed_by uuid references auth.users(id) on delete set null default auth.uid(),
  confirmed_by_name text not null default '',
  confirmed_at timestamptz not null default now()
);

alter table public.weekly_reports enable row level security;

drop policy if exists "weekly_reports select" on public.weekly_reports;
create policy "weekly_reports select" on public.weekly_reports
  for select to authenticated using (public.is_active_member());

-- 확정(insert) · 해제(delete) 는 관리자만, 확정본 수정(update) 정책은 두지 않음
drop policy if exists "weekly_reports insert by admin" on public.weekly_reports;
create policy "weekly_reports insert by admin" on public.weekly_reports
  for insert to authenticated with check (public.is_admin());

drop policy if exists "weekly_reports delete by admin" on public.weekly_reports;
create policy "weekly_reports delete by admin" on public.weekly_reports
  for delete to authenticated using (public.is_admin());

-- 3. 변경 이력
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid,
  actor_name text not null default '',
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

-- 조회는 관리자만. 쓰기 정책 없음 → 트리거(security definer) 로만 기록되고 수정/삭제 불가
drop policy if exists "audit_logs select by admin" on public.audit_logs;
create policy "audit_logs select by admin" on public.audit_logs
  for select to authenticated using (public.is_admin());

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor uuid := auth.uid();
  v_name text;
begin
  -- 수정은 실제로 바뀐 칸만 남김 (updated_at 만 바뀐 경우는 기록 안 함)
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into v_new
      from jsonb_each(to_jsonb(new)) n
     where n.key <> 'updated_at' and (to_jsonb(old) -> n.key) is distinct from n.value;
    if v_new is null then
      return new;
    end if;
    select jsonb_object_agg(o.key, o.value) into v_old
      from jsonb_each(to_jsonb(old)) o
     where v_new ? o.key;
  end if;

  -- 확정본 스냅샷은 이력에 통째로 넣지 않음
  if tg_table_name = 'weekly_reports' then
    v_old := v_old - 'snapshot';
    v_new := v_new - 'snapshot';
  end if;

  select u.name into v_name from public.app_users u where u.auth_user_id = v_actor;

  insert into public.audit_logs (table_name, record_id, action, actor_id, actor_name, old_data, new_data)
  values (
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'week_start', ''),
    lower(tg_op),
    v_actor,
    coalesce(v_name, case when v_actor is null then '시스템' else '' end),
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'app_users', 'departments', 'positions', 'weekly_reports'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()',
      t || '_audit', t
    );
  end loop;
end $$;
