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

// Supabase Auth 는 이메일 기반이므로 아이디를 내부 이메일(아이디@zenith.kr)로 변환해 사용 — 사용자에게는 노출하지 않음
export const AUTH_EMAIL_DOMAIN = "zenith.kr";
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export type AppUser = {
  id: string;
  username: string;
  email: string;
  password?: string;
  name: string;
  department: string;
  department_id?: string | null;
  position_id?: string | null;
  role: UserRole;
  is_active: boolean;
  created_by: string;
  created_at: string;
  supabase_synced?: boolean;
};

// 조직도(부서) — parent_id 로 상하위 트리 구성
export type Department = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

// 직급 — rank 가 작을수록 높은 직급
export type Position = {
  id: string;
  name: string;
  rank: number;
};

// 부서를 트리 순서(부모 → 자식, sort_order 순)로 펼치고 깊이를 함께 반환
export function flattenDepartments(
  departments: Department[],
): { dept: Department; depth: number }[] {
  const byParent = new Map<string | null, Department[]>();
  for (const d of departments) {
    const key = d.parent_id && departments.some((p) => p.id === d.parent_id) ? d.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), d]);
  }
  const out: { dept: Department; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    const children = (byParent.get(parent) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    for (const c of children) {
      out.push({ dept: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// 자기 자신과 모든 하위 부서 id (상위 부서 변경 시 순환 방지용)
export function descendantIds(departments: Department[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of departments) {
      if (d.parent_id && ids.has(d.parent_id) && !ids.has(d.id)) {
        ids.add(d.id);
        grew = true;
      }
    }
  }
  return ids;
}

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

type AppUserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  department: string | null;
  department_id?: string | null;
  position_id?: string | null;
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
    department_id: u.department_id ?? null,
    position_id: u.position_id ?? null,
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
