-- ============================================================================
-- 보안 강화 마이그레이션
--  - 평문 비밀번호 컬럼(password_hash) 제거 → 인증은 Supabase Auth 로만 처리
--  - 관리자 계정(admin@zenith.kr)을 app_users 와 연결
--  - RLS: 익명 접근 차단, 활성 사용자만 조회/업무 편집, 계정 관리는 관리자만
-- ============================================================================

-- 1. 관리자 Auth 계정이 이미 있으면 app_users 와 연결
--    (계정 생성/비밀번호 설정은 git 에 올리지 않는 supabase/admin_bootstrap.local.sql 로 별도 실행)
update public.app_users u
   set auth_user_id = a.id, role = '관리자', is_active = true
  from auth.users a
 where a.email = 'admin@zenith.kr' and u.username = 'admin';

-- 2. 평문 비밀번호 컬럼 제거
alter table public.app_users drop column if exists password_hash;

alter table public.app_users
  drop constraint if exists app_users_auth_user_id_key;
alter table public.app_users
  add constraint app_users_auth_user_id_key unique (auth_user_id);

-- 3. 권한 판별 함수 (RLS 재귀 방지를 위해 security definer)
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_users
     where auth_user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_users
     where auth_user_id = auth.uid() and is_active and role = '관리자'
  );
$$;

revoke execute on function public.is_active_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 4. 기존 전체 허용 정책 제거
drop policy if exists "Allow read app_users" on public.app_users;
drop policy if exists "Allow write app_users" on public.app_users;
drop policy if exists "Allow all app_users" on public.app_users;
drop policy if exists "Allow all tasks" on public.tasks;

-- 5. app_users: 본인 행 또는 활성 사용자만 조회, 쓰기는 관리자만
create policy "app_users select" on public.app_users
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_active_member());

create policy "app_users insert by admin" on public.app_users
  for insert to authenticated
  with check (public.is_admin());

create policy "app_users update by admin" on public.app_users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "app_users delete by admin" on public.app_users
  for delete to authenticated
  using (public.is_admin());

-- 6. tasks: 활성 사용자만 조회/편집 (익명 차단)
create policy "tasks for active members" on public.tasks
  for all to authenticated
  using (public.is_active_member())
  with check (public.is_active_member());
