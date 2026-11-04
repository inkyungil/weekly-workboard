-- ============================================================================
-- 칸반 주간/월간 조회용 업무 주차별 상태 기록
--  - 업무가 추가·수정·삭제될 때마다 그 주(월요일, 한국시간)의 상태를 1행으로 기록 (같은 주는 덮어씀)
--  - 특정 주의 보드 = 그 주까지의 마지막 기록 (변경 없는 업무는 이전 상태가 이어짐)
--  - 기록은 이 마이그레이션 시점부터 쌓임. 기존 업무는 마지막 수정 주에 현재 상태로 1행씩 채움
-- ============================================================================

create table if not exists public.task_weekly_states (
  task_id text not null,
  week_start date not null,
  code text not null default '',
  field text not null default '',
  title text not null default '',
  owner text not null default '',
  due text not null default '',
  status text not null default '',
  progress text not null default '',
  issue text not null default '',
  deleted boolean not null default false,
  recorded_at timestamptz not null default now(),
  primary key (task_id, week_start)
);

create index if not exists task_weekly_states_week_idx on public.task_weekly_states (week_start);

alter table public.task_weekly_states enable row level security;

-- 조회는 활성 사용자. 쓰기 정책 없음 → 트리거로만 기록
drop policy if exists "task_weekly_states select" on public.task_weekly_states;
create policy "task_weekly_states select" on public.task_weekly_states
  for select to authenticated using (public.is_active_member());

create or replace function public.week_start_kst(ts timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', ts at time zone 'Asia/Seoul')::date;
$$;

create or replace function public.record_task_weekly_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.tasks%rowtype := case when tg_op = 'DELETE' then old else new end;
begin
  insert into public.task_weekly_states
    (task_id, week_start, code, field, title, owner, due, status, progress, issue, deleted, recorded_at)
  values (
    r.id, public.week_start_kst(now()), r.code, r.field, r.title, r.owner, r.due, r.status,
    r.progress, r.issue, tg_op = 'DELETE', now()
  )
  on conflict (task_id, week_start) do update set
    code = excluded.code,
    field = excluded.field,
    title = excluded.title,
    owner = excluded.owner,
    due = excluded.due,
    status = excluded.status,
    progress = excluded.progress,
    issue = excluded.issue,
    deleted = excluded.deleted,
    recorded_at = excluded.recorded_at;
  return null;
end;
$$;

revoke execute on function public.record_task_weekly_state() from public, anon, authenticated;

drop trigger if exists tasks_weekly_state on public.tasks;
create trigger tasks_weekly_state
  after insert or update or delete on public.tasks
  for each row execute function public.record_task_weekly_state();

-- 기존 업무: 마지막 수정 주에 현재 상태로 기록
insert into public.task_weekly_states
  (task_id, week_start, code, field, title, owner, due, status, progress, issue, recorded_at)
select t.id, public.week_start_kst(coalesce(t.updated_at, t.created_at)), t.code, t.field, t.title,
       t.owner, t.due, t.status, t.progress, t.issue, coalesce(t.updated_at, t.created_at)
  from public.tasks t
on conflict (task_id, week_start) do nothing;
