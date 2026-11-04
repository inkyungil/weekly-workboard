-- ============================================================================
-- 자료 올리기: 올린 파일 목록
--  - 파일(또는 직접 입력 시트) 1개 = 1행, 읽은 업무 행은 rows(jsonb 배열)로 보관
--  - kind: current(이번 주 업무일지) / prev(지난주 보고서, 비교 기준)
--  - applied_at: 업무로 반영한 시각 (null = 미반영)
--  - 조회는 활성 사용자, 수정·삭제는 올린 사람 또는 관리자
-- ============================================================================

create table if not exists public.upload_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  kind text not null default 'current' check (kind in ('current', 'prev')),
  week_start date not null,
  rows jsonb not null default '[]'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  uploaded_by_name text not null default '',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upload_files_week_idx on public.upload_files (week_start desc, created_at desc);

drop trigger if exists upload_files_touch_updated_at on public.upload_files;
create trigger upload_files_touch_updated_at
  before update on public.upload_files
  for each row execute function public.touch_updated_at();

alter table public.upload_files enable row level security;

drop policy if exists "upload_files select" on public.upload_files;
create policy "upload_files select" on public.upload_files
  for select to authenticated using (public.is_active_member());

drop policy if exists "upload_files insert" on public.upload_files;
create policy "upload_files insert" on public.upload_files
  for insert to authenticated
  with check (public.is_active_member() and uploaded_by = auth.uid());

drop policy if exists "upload_files update by owner or admin" on public.upload_files;
create policy "upload_files update by owner or admin" on public.upload_files
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_admin())
  with check (uploaded_by = auth.uid() or public.is_admin());

drop policy if exists "upload_files delete by owner or admin" on public.upload_files;
create policy "upload_files delete by owner or admin" on public.upload_files
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- 변경 이력에도 기록 — 이력 함수에 upload_files 의 rows 를 행 수로 줄이는 처리 추가
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

  -- 올린 파일의 행 내용은 이력에 통째로 넣지 않고 행 수만 남김
  if tg_table_name = 'upload_files' then
    if v_old ? 'rows' then
      v_old := (v_old - 'rows') || jsonb_build_object('row_count', jsonb_array_length(v_old -> 'rows'));
    end if;
    if v_new ? 'rows' then
      v_new := (v_new - 'rows') || jsonb_build_object('row_count', jsonb_array_length(v_new -> 'rows'));
    end if;
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



drop trigger if exists upload_files_audit on public.upload_files;
create trigger upload_files_audit
  after insert or update or delete on public.upload_files
  for each row execute function public.write_audit_log();
