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
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_USERS;
    // 예전 버전에서 캐시된 비밀번호는 제거
    return parsed.map(({ password: _password, ...u }) => u);
  } catch {
    return INITIAL_USERS;
  }
}

export function saveLocalUsers(users: AppUser[]) {
  try {
    localStorage.setItem(
      LOCAL_USERS_KEY,
      JSON.stringify(users.map(({ password: _password, ...u }) => u)),
    );
  } catch {
    // ignore storage errors
  }
}

export const SUPABASE_INIT_SQL = `-- supabase/migrations 의 SQL 을 \`npx supabase db push --remote\` 로 반영하세요.
-- 요약: 비밀번호는 Supabase Auth 에만 저장되며, app_users 는 프로필/권한만 보관합니다.
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text unique not null,
  email text unique not null,
  name text not null,
  department text not null default '복리후생/총무',
  role text not null default '팀원' check (role in ('관리자', '팀원')),
  is_active boolean not null default true,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.tasks enable row level security;

-- 조회: 본인 또는 활성 사용자 / 계정 쓰기: 관리자만 / 업무: 활성 사용자만
create policy "app_users select" on public.app_users for select to authenticated
  using (auth_user_id = auth.uid() or public.is_active_member());
create policy "app_users insert by admin" on public.app_users for insert to authenticated
  with check (public.is_admin());
create policy "app_users update by admin" on public.app_users for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "app_users delete by admin" on public.app_users for delete to authenticated
  using (public.is_admin());
create policy "tasks for active members" on public.tasks for all to authenticated
  using (public.is_active_member()) with check (public.is_active_member());`;

type AppUserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  department: string | null;
  role: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
};

export function mapAppUserRow(u: AppUserRow): AppUser {
  return {
    id: String(u.id),
    username: String(u.username),
    email: String(u.email),
    name: String(u.name),
    department: String(u.department || "복리후생/총무"),
    role: (u.role as UserRole) || "팀원",
    is_active: Boolean(u.is_active ?? true),
    created_by: String(u.created_by || "admin"),
    created_at: String(u.created_at || "").slice(0, 10) || "2026-11-04",
    supabase_synced: true,
  };
}

// 로그인한 Auth 사용자의 프로필/권한을 app_users 에서 조회 (권한은 user_metadata 가 아닌 DB 기준)
export async function fetchProfile(authUserId: string): Promise<AppUser | null> {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data ? mapAppUserRow(data as AppUserRow) : null;
}
