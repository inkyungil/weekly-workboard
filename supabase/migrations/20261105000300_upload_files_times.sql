-- ============================================================================
-- 올린 파일: '반영 후 수정됨' 오표시 수정
--  - updated_at 은 파일 내용(rows)·이름이 바뀔 때만 갱신 (반영 표시만 할 때는 그대로)
--  - applied_at 은 브라우저 시각이 아니라 서버 시각으로 기록
--    → 두 시각을 같은 서버 시계로 비교해 '반영 후 수정됨' 을 정확히 판단
-- ============================================================================

create or replace function public.upload_files_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rows is distinct from old.rows or new.file_name is distinct from old.file_name then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  if new.applied_at is not null and new.applied_at is distinct from old.applied_at then
    new.applied_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists upload_files_touch_updated_at on public.upload_files;
create trigger upload_files_touch_updated_at
  before update on public.upload_files
  for each row execute function public.upload_files_times();
