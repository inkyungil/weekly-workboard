import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || "https://gbhofltptnincbkvgtqc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_TuyPDw8l7COndCpOBVGQ9w_UygnIjEJ";
export const SUPABASE_PROJECT_REF = "gbhofltptnincbkvgtqc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// 관리자 수동 계정 등록 시 현재 로그인된 관리자 세션을 덮어쓰지 않도록 분리된 Auth 클라이언트
export const supabaseAdminRegistrar = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "zenith-admin-registrar-token",
    },
  },
);

export type UserRole = "관리자" | "팀원";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  department: string;
  role: UserRole;
  is_active: boolean;
  created_by: string;
  created_at: string;
  supabase_synced?: boolean;
};

export const INITIAL_USERS: AppUser[] = [
  {
    id: "usr-admin",
    username: "admin",
    email: "admin@zenith.kr",
    password: "1234",
    name: "관리자",
    department: "총무기획팀",
    role: "관리자",
    is_active: true,
    created_by: "system",
    created_at: "2026-11-01",
    supabase_synced: true,
  },
  {
    id: "usr-1",
    username: "kimcs",
    email: "kimcs@zenith.kr",
    password: "1234",
    name: "김철수",
    department: "복리후생/총무",
    role: "팀원",
    is_active: true,
    created_by: "admin",
    created_at: "2026-11-02",
    supabase_synced: true,
  },
  {
    id: "usr-2",
    username: "leeyh",
    email: "leeyh@zenith.kr",
    password: "1234",
    name: "이영희",
    department: "복리후생/총무",
    role: "팀원",
    is_active: true,
    created_by: "admin",
    created_at: "2026-11-02",
    supabase_synced: true,
  },
  {
    id: "usr-3",
    username: "parkms",
    email: "parkms@zenith.kr",
    password: "1234",
    name: "박민수",
    department: "사회공헌/의전",
    role: "팀원",
    is_active: true,
    created_by: "admin",
    created_at: "2026-11-03",
    supabase_synced: true,
  },
];

const LOCAL_USERS_KEY = "zenith_registered_users_v1";

export function loadLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return INITIAL_USERS;
    const parsed = JSON.parse(raw) as AppUser[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
  } catch {
    return INITIAL_USERS;
  }
}

export function saveLocalUsers(users: AppUser[]) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

export const SUPABASE_INIT_SQL = `-- Supabase SQL Editor에서 실행하거나 \`npx supabase db push\`로 반영하세요.
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

alter table public.app_users enable row level security;
alter table public.tasks enable row level security;

create policy "Allow all app_users" on public.app_users for all using (true) with check (true);
create policy "Allow all tasks" on public.tasks for all using (true) with check (true);`;
