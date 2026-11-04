-- ============================================================================
-- Zenith 업무관리 시스템 (Weekly Workboard) Supabase 초기 스키마 마이그레이션
-- Project Ref: gbhofltptnincbkvgtqc
-- ============================================================================

-- 1. 사용자 계정 관리 테이블 (관리자 수동 등록 전용)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  username text unique not null,
  email text unique not null,
  password_hash text not null default '1234',
  name text not null,
  department text not null default '복리후생/총무',
  role text not null default '팀원' check (role in ('관리자', '팀원')),
  is_active boolean not null default true,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

-- 2. 주간 업무(칸반/보고서) 테이블
create table if not exists public.tasks (
  id text primary key,
  code text not null,
  field text not null,
  title text not null,
  owner text not null,
  due text not null,
  status text not null check (status in ('대기', '진행 중', '지연 / 이슈', '완료')),
  progress text not null default '',
  issue text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 활성화 및 정책 설정
alter table public.app_users enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Allow read app_users" on public.app_users;
create policy "Allow read app_users" on public.app_users
  for select using (true);

drop policy if exists "Allow write app_users" on public.app_users;
create policy "Allow write app_users" on public.app_users
  for all using (true) with check (true);

drop policy if exists "Allow all tasks" on public.tasks;
create policy "Allow all tasks" on public.tasks
  for all using (true) with check (true);

-- 초기 관리자 및 샘플 계정 시드
insert into public.app_users (username, email, password_hash, name, department, role, is_active)
values
  ('admin', 'admin@zenith.kr', '1234', '관리자', '총무기획팀', '관리자', true),
  ('kimcs', 'kimcs@zenith.kr', '1234', '김철수', '복리후생/총무', '팀원', true),
  ('leeyh', 'leeyh@zenith.kr', '1234', '이영희', '복리후생/총무', '팀원', true),
  ('parkms', 'parkms@zenith.kr', '1234', '박민수', '사회공헌/의전', '팀원', true)
on conflict (username) do nothing;

-- 초기 샘플 업무 데이터 시드
insert into public.tasks (id, code, field, title, owner, due, status, progress, issue)
values
  ('t-1', 'TSK-1001', '복리후생/총무', '동계 콘도 추첨 시스템 오픈', '김철수', '2026-11-04', '지연 / 이슈', '인증 오류 조치 중', '외부 연동 지연'),
  ('t-2', 'TSK-1002', '복리후생/총무', '4분기 건강검진 안내', '이영희', '2026-11-04', '완료', '전사 안내 완료', ''),
  ('t-3', 'TSK-1003', '사회공헌/의전', '연말 연탄나눔 기획', '박민수', '2026-11-10', '진행 중', '수혜 가구 선정 중', ''),
  ('t-4', 'TSK-1004', '자산', '하반기 고정자산 실사', '최동석', '2026-11-05', '완료', '1차 바코드 실사 완료', ''),
  ('t-5', 'TSK-1005', '비상계획', '동절기 소방시설 점검', '정대리', '2026-11-12', '대기', '체크리스트 작성 완료', '')
on conflict (id) do nothing;
