-- ============================================================================
-- 계정관리: 조직도(부서) / 직급 테이블 추가 및 회원 연결
--  - departments: parent_id 로 상하위 조직 트리 구성
--  - positions: rank 가 작을수록 높은 직급
--  - app_users.department_id / position_id 로 회원 소속·직급 관리
--  - 조직·직급 데이터는 코드에 두지 않고 DB 에서만 관리
--    (기존 app_users.department 텍스트는 화면 표시 호환용으로 부서명과 함께 유지)
-- ============================================================================

-- 1. 조직(부서)
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.departments(id) on delete restrict,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists departments_parent_name_key
  on public.departments (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- 2. 직급
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  rank int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. 회원 ↔ 조직/직급 연결
alter table public.app_users
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists position_id uuid references public.positions(id) on delete set null;

-- 4. 기존 회원 데이터의 부서명으로 최상위 조직 생성 (직급은 관리자가 화면에서 등록)
insert into public.departments (name)
select distinct u.department
  from public.app_users u
 where coalesce(u.department, '') <> ''
   and not exists (
     select 1 from public.departments d where d.parent_id is null and d.name = u.department
   );

-- 5. 기존 회원의 부서 텍스트로 department_id 채우기
update public.app_users u
   set department_id = d.id
  from public.departments d
 where u.department_id is null and d.parent_id is null and d.name = u.department;

-- 6. RLS: 조회는 활성 사용자, 변경은 관리자만
alter table public.departments enable row level security;
alter table public.positions enable row level security;

drop policy if exists "departments select" on public.departments;
create policy "departments select" on public.departments
  for select to authenticated using (public.is_active_member());

drop policy if exists "departments write by admin" on public.departments;
create policy "departments write by admin" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "positions select" on public.positions;
create policy "positions select" on public.positions
  for select to authenticated using (public.is_active_member());

drop policy if exists "positions write by admin" on public.positions;
create policy "positions write by admin" on public.positions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
