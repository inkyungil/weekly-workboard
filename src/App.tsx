import {
  useState,
  useEffect,
  useMemo,
  type DragEvent,
  type ReactNode,
  type FormEvent,
} from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload as UploadIcon,
  Kanban as KanbanIcon,
  FileText,
  Bell,
  Settings,
  Search,
  Plus,
  Sun,
  Moon,
  Monitor,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  UserPlus,
  Users,
  Copy,
  Trash2,
  X,
  Menu,
  Sparkles,
  FileSpreadsheet,
  CheckCheck,
  PanelLeft,
  PanelTop,
  Maximize2,
  Minimize2,
  Lock,
  Network,
  Award,
  Pencil,
  ArrowUp,
  ArrowDown,
  Check,
  ClipboardCheck,
  History,
  Download,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  addMonths,
  changedInWeek,
  monthOf,
  monthTimeline,
  stateAsOf,
  weekOrdinalLabel,
  weeksOfMonth,
  type WeeklyState,
} from "@/lib/history";
import {
  STATUSES,
  analysisToTasks,
  analyzeDrafts,
  compareWeeks,
  fieldsOf,
  isOverdue,
  normalizeDate,
  todayIso,
  rowsToDrafts,
  DRAFT_KEYS,
  TEMPLATE_HEADERS,
  type Draft,
  type RowAnalysis,
  type Status,
  type TaskLike,
  type WeekComparison,
} from "@/lib/analysis";
import {
  addWeeks,
  buildSubmissionStatus,
  DIST_COLUMNS,
  FIELD_LABELS,
  mergeDistRows,
  parseDistSheet,
  reminderText,
  tasksForDepartment,
  toDistRows,
  weekLabel,
  weekStartOf,
  type MergeField,
  type MergeResult,
} from "@/lib/weekly";
import {
  supabase,
  supabaseAdminRegistrar,
  SUPABASE_PROJECT_REF,
  fetchProfile,
  mapAppUserRow,
  loadLocalUsers,
  saveLocalUsers,
  usernameToAuthEmail,
  USERNAME_PATTERN,
  flattenDepartments,
  descendantIds,
  type AppUser,
  type Department,
  type Position,
  type UserRole,
} from "@/lib/supabase";

export const FIELDS = ["복리후생/총무", "사회공헌/의전", "자산", "비상계획"] as const;
export { STATUSES, type Status };

export type Task = {
  id: string;
  code: string;
  field: string;
  title: string;
  owner: string;
  due: string;
  status: Status;
  progress: string;
  issue: string;
  updated_at?: string;
};

type ActivityItem = {
  id: string;
  type: "task" | "complete" | "issue" | "upload" | "report";
  title: string;
  description: string;
  time: string;
  read: boolean;
};

type ViewId =
  | "dashboard"
  | "upload"
  | "kanban"
  | "report"
  | "status"
  | "distribute"
  | "audit"
  | "members"
  | "org"
  | "positions";

// 화면별 URL
const VIEW_PATHS: Record<ViewId, string> = {
  dashboard: "/dashboard",
  upload: "/upload",
  kanban: "/kanban",
  report: "/report",
  status: "/status",
  distribute: "/distribute",
  audit: "/audit",
  members: "/accounts/members",
  org: "/accounts/org",
  positions: "/accounts/positions",
};
const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: "대시보드",
  upload: "자료 올리기",
  kanban: "진행상태",
  report: "주간업무보고서",
  status: "제출 현황",
  distribute: "배포 · 취합",
  audit: "변경 이력",
  members: "회원 관리",
  org: "조직도 관리",
  positions: "직급 관리",
};
// 관리자 전용 화면
const ACCOUNT_VIEWS: ViewId[] = ["distribute", "audit", "members", "org", "positions"];
// 예전 주소 호환
const LEGACY_PATHS: Record<string, ViewId> = { "/users": "members", "/accounts": "members" };

const viewPath = (v: ViewId) => VIEW_PATHS[v];
const pathToView = (pathname: string): ViewId | null => {
  const path = pathname.replace(/\/+$/, "") || "/";
  const found = (Object.keys(VIEW_PATHS) as ViewId[]).find((v) => VIEW_PATHS[v] === path);
  return found ?? null;
};
type ThemeMode = "light" | "dark" | "system";
type ColorPreset = "neutral" | "zinc" | "blue" | "violet" | "rose" | "orange";
type DensityMode = "compact" | "comfortable" | "spacious";
type LayoutMode = "sidebar" | "topnav";
type ContainerMode = "fluid" | "boxed";

let taskSeq = 1006;
const uid = () => Math.random().toString(36).slice(2, 10);
const nextCode = () => `TSK-${taskSeq++}`;

const SAMPLE: Task[] = [
  {
    id: "t-1",
    code: "TSK-1001",
    field: "복리후생/총무",
    title: "동계 콘도 추첨 시스템 오픈",
    owner: "김철수",
    due: "2026-11-04",
    status: "지연 / 이슈",
    progress: "인증 오류 조치 중",
    issue: "외부 연동 지연",
  },
  {
    id: "t-2",
    code: "TSK-1002",
    field: "복리후생/총무",
    title: "4분기 건강검진 안내",
    owner: "이영희",
    due: "2026-11-04",
    status: "완료",
    progress: "전사 안내 완료",
    issue: "",
  },
  {
    id: "t-3",
    code: "TSK-1003",
    field: "사회공헌/의전",
    title: "연말 연탄나눔 기획",
    owner: "박민수",
    due: "2026-11-10",
    status: "진행 중",
    progress: "수혜 가구 선정 중",
    issue: "",
  },
  {
    id: "t-4",
    code: "TSK-1004",
    field: "자산",
    title: "하반기 고정자산 실사",
    owner: "최동석",
    due: "2026-11-05",
    status: "완료",
    progress: "1차 바코드 실사 완료",
    issue: "",
  },
  {
    id: "t-5",
    code: "TSK-1005",
    field: "비상계획",
    title: "동절기 소방시설 점검",
    owner: "정대리",
    due: "2026-11-12",
    status: "대기",
    progress: "체크리스트 작성 완료",
    issue: "",
  },
];

const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    type: "issue",
    title: "지연 / 이슈 발생 알림",
    description: "김철수 — 동계 콘도 추첨 시스템 오픈 (외부 연동 지연)",
    time: "방금 전",
    read: false,
  },
  {
    id: "act-2",
    type: "complete",
    title: "업무 완료 처리",
    description: "이영희 — 4분기 건강검진 안내 (전사 안내 완료)",
    time: "15분 전",
    read: false,
  },
  {
    id: "act-3",
    type: "complete",
    title: "고정자산 실사 1차 완료",
    description: "최동석 — 하반기 고정자산 실사 바코드 점검 완료",
    time: "1시간 전",
    read: false,
  },
  {
    id: "act-4",
    type: "task",
    title: "신규 기획 업무 진행 중",
    description: "박민수 — 연말 연탄나눔 기획 (수혜 가구 선정 중)",
    time: "2시간 전",
    read: true,
  },
  {
    id: "act-5",
    type: "upload",
    title: "비상계획 점검 일정 등록",
    description: "정대리 — 동절기 소방시설 점검 체크리스트 작성",
    time: "4시간 전",
    read: true,
  },
];

const MONTHLY_TREND_DATA = [
  { month: "6월", completed: 18, total: 22, rate: 82 },
  { month: "7월", completed: 24, total: 28, rate: 86 },
  { month: "8월", completed: 21, total: 25, rate: 84 },
  { month: "9월", completed: 29, total: 33, rate: 88 },
  { month: "10월", completed: 34, total: 38, rate: 89 },
  { month: "11월 1주", completed: 38, total: 42, rate: 90 },
];

const COLOR_PRESETS: { key: ColorPreset; label: string }[] = [
  { key: "neutral", label: "Neutral" },
  { key: "zinc", label: "Zinc" },
  { key: "blue", label: "Blue" },
  { key: "violet", label: "Violet" },
  { key: "rose", label: "Rose" },
  { key: "orange", label: "Orange" },
];

const AVATAR_GRADIENTS = [
  "from-chart-1/70 to-chart-1",
  "from-chart-2/70 to-chart-2",
  "from-chart-3/70 to-chart-3",
  "from-chart-4/70 to-chart-4",
  "from-chart-5/70 to-chart-5",
];

const fieldColor: Record<string, string> = {
  "복리후생/총무": "bg-chart-1/10 text-chart-1 border-chart-1/20",
  "사회공헌/의전": "bg-chart-2/10 text-chart-2 border-chart-2/20",
  자산: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  비상계획: "bg-chart-5/15 text-chart-5 border-chart-5/25",
};

const statusBadgeStyle: Record<Status, string> = {
  완료: "bg-success/15 text-success border-success/25",
  "진행 중": "bg-primary/10 text-primary border-primary/20",
  대기: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/30",
  "지연 / 이슈": "bg-destructive/15 text-destructive border-destructive/25",
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30";
const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 cursor-pointer";
const btnPrimary = `${btn} bg-primary text-primary-foreground shadow-xs hover:bg-primary/90`;
const btnOutline = `${btn} border border-input bg-background hover:bg-accent hover:text-accent-foreground`;

function ZenithCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-xs transition-all duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Workboard />
    </BrowserRouter>
  );
}

function Workboard() {
  const location = useLocation();
  const navigate = useNavigate();
  // Supabase Auth: 로그인 화면부터 시작하며, 회원가입은 관리자가 직접 수동 등록으로 진행
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [users, setUsers] = useState<AppUser[]>(() => loadLocalUsers());
  const [currentUser, setCurrentUser] = useState<AppUser>(
    () => loadLocalUsers()[0]!,
  );
  const [tasks, setTasks] = useState<Task[]>(SAMPLE);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const activeView: ViewId = pathToView(location.pathname) ?? "dashboard";
  const setActiveView = (v: ViewId) => navigate(viewPath(v));
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [dbTableReady, setDbTableReady] = useState(false);

  // Zenith Shell State
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);

  // Zenith Theme Customizer State
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [colorPreset, setColorPreset] = useState<ColorPreset>("neutral");
  const [density, setDensity] = useState<DensityMode>("comfortable");
  const [layout, setLayout] = useState<LayoutMode>("sidebar");
  const [container, setContainer] = useState<ContainerMode>("fluid");

  // Collapsible Sidebar Groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    workboard: true,
    system: true,
  });

  // Toast State
  const [toast, setToast] = useState("");
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2800);
  };

  // Persist users locally as cache
  useEffect(() => {
    saveLocalUsers(users);
  }, [users]);

  // 로그인 후 tasks / app_users 를 Supabase 에서 불러옴 (RLS 상 인증 사용자만 조회 가능)
  const loadRemoteData = async (isMounted: () => boolean = () => true) => {
    const { data: remoteTasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!tasksErr && Array.isArray(remoteTasks) && isMounted()) {
      setDbTableReady(true);
      if (remoteTasks.length > 0) {
        setTasks(remoteTasks as Task[]);
      }
    }

    const { data: remoteUsers, error: usersErr } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: true });

    if (!usersErr && Array.isArray(remoteUsers) && remoteUsers.length > 0 && isMounted()) {
      setDbTableReady(true);
      setUsers(remoteUsers.map(mapAppUserRow));
    }

    const [{ data: remoteDepts, error: deptErr }, { data: remotePositions, error: posErr }] =
      await Promise.all([
        supabase.from("departments").select("id, name, parent_id, sort_order"),
        supabase.from("positions").select("id, name, rank").order("rank", { ascending: true }),
      ]);
    if (!deptErr && Array.isArray(remoteDepts) && isMounted()) {
      setDepartments(remoteDepts as Department[]);
    }
    if (!posErr && Array.isArray(remotePositions) && isMounted()) {
      setPositions(remotePositions as Position[]);
    }
  };

  // Initial Supabase session & database sync
  useEffect(() => {
    let mounted = true;

    async function initSupabase() {
      try {
        // 1. Check active Supabase Auth session → 권한/활성 여부는 app_users 기준
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (!authUser) return;

        const profile = await fetchProfile(authUser.id);
        if (!mounted) return;
        if (!profile || !profile.is_active) {
          await supabase.auth.signOut();
          return;
        }
        setCurrentUser(profile);
        setIsLoggedIn(true);
        await loadRemoteData(() => mounted);
      } catch {
        if (mounted) setSupabaseConnected(false);
      } finally {
        if (mounted) setAuthChecked(true);
      }
    }

    initSupabase();
    return () => {
      mounted = false;
    };
  }, []);

  // URL 가드: 비로그인 → /login (원래 가려던 경로 기억), 로그인 상태에서 /login·/·없는 경로 → 화면으로 이동
  useEffect(() => {
    if (!authChecked) return;
    const legacy = LEGACY_PATHS[location.pathname.replace(/\/+$/, "")];
    if (legacy) {
      navigate(viewPath(legacy), { replace: true });
      return;
    }
    const view = pathToView(location.pathname);
    if (!isLoggedIn) {
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true, state: { from: view ? location.pathname : undefined } });
      }
    } else if (!view) {
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? viewPath("dashboard"), { replace: true });
    } else if (ACCOUNT_VIEWS.includes(view) && currentUser.role !== "관리자") {
      navigate(viewPath("dashboard"), { replace: true });
    }
  }, [authChecked, isLoggedIn, currentUser.role, location.pathname, location.state, navigate]);

  useEffect(() => {
    document.title = isLoggedIn
      ? `${VIEW_TITLES[activeView]} · 업무보고`
      : "로그인 · 업무보고";
  }, [isLoggedIn, activeView]);

  // Apply Zenith theme / preset / density to <html>
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (colorPreset === "neutral") {
      root.removeAttribute("data-color-preset");
    } else {
      root.setAttribute("data-color-preset", colorPreset);
    }
  }, [colorPreset]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-comfortable", "density-spacious");
    root.classList.add(`density-${density}`);
  }, [density]);

  // Command Palette shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const addActivity = (item: Omit<ActivityItem, "id" | "time" | "read">) => {
    setActivities((prev) => [
      { ...item, id: uid(), time: "방금 전", read: false },
      ...prev.slice(0, 14),
    ]);
  };

  const syncTaskToSupabase = async (task: Task) => {
    try {
      await supabase.from("tasks").upsert({
        id: task.id,
        code: task.code,
        field: task.field,
        title: task.title,
        owner: task.owner,
        due: task.due,
        status: task.status,
        progress: task.progress,
        issue: task.issue,
      });
    } catch {
      // ignore if table not yet migrated
    }
  };

  // 칸반 편집 창 저장 — DB 저장이 성공해야 화면에 반영
  const saveTask = async (task: Task): Promise<boolean> => {
    const { updated_at: _u, ...row } = task;
    const { error } = await supabase.from("tasks").upsert(row);
    if (error) {
      notify(`업무 저장 실패: ${error.message}`);
      return false;
    }
    const saved = { ...task, updated_at: new Date().toISOString() };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? saved : t)));
    notify(`'${task.title}' 업무가 저장되었습니다.`);
    return true;
  };

  // 업로드 분석 결과 반영 — 같은 id 는 갱신, 나머지는 추가. DB 저장에 실패하면 화면도 바꾸지 않음
  const handleAddTasks = async (incoming: Task[]): Promise<boolean> => {
    const { error } = await supabase.from("tasks").upsert(
      incoming.map((t) => ({
        id: t.id,
        code: t.code,
        field: t.field,
        title: t.title,
        owner: t.owner,
        due: t.due,
        status: t.status,
        progress: t.progress,
        issue: t.issue,
      })),
    );
    if (error) {
      notify(`업무 저장 실패: ${error.message}`);
      return false;
    }
    const existingIds = new Set(tasks.map((t) => t.id));
    const updatedCount = incoming.filter((t) => existingIds.has(t.id)).length;
    const now = new Date().toISOString();
    const byId = new Map(incoming.map((t) => [t.id, { ...t, updated_at: now }]));
    setTasks((prev) => [
      ...incoming.filter((t) => !prev.some((p) => p.id === t.id)).map((t) => byId.get(t.id)!),
      ...prev.map((t) => byId.get(t.id) ?? t),
    ]);
    addActivity({
      type: "upload",
      title: `업무 자료 ${incoming.length}건 반영 완료`,
      description: `신규 ${incoming.length - updatedCount}건 · 기존 업무 갱신 ${updatedCount}건`,
    });
    notify(`${incoming.length}건 반영 (신규 ${incoming.length - updatedCount} · 갱신 ${updatedCount})`);
    return true;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setIsLoggedIn(false);
    notify("로그아웃되었습니다.");
  };

  const delayedCount = useMemo(
    () => tasks.filter((t) => t.status === "지연 / 이슈").length,
    [tasks],
  );
  const unreadNotifCount = useMemo(
    () => activities.filter((a) => !a.read).length,
    [activities],
  );

  // ----------------------------------------------------------------------------
  // LOGIN GATE (Starts at Login screen; Sign-up is admin-only manual registration)
  // ----------------------------------------------------------------------------
  // 세션 확인 전에는 로그인 화면이 깜빡이지 않도록 대기
  if (!authChecked) return null;

  if (!isLoggedIn) {
    return (
      <>
        <Login
          onLoginSuccess={(loggedInUser) => {
            setCurrentUser(loggedInUser);
            setIsLoggedIn(true);
            void loadRemoteData();
            notify(`${loggedInUser.name} (${loggedInUser.role}) 님 환영합니다!`);
          }}
        />
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
            <Sparkles className="h-4 w-4 shrink-0" />
            {toast}
          </div>
        )}
      </>
    );
  }

  const navGroups = [
    {
      key: "overview",
      label: "Overview",
      items: [
        {
          id: "dashboard" as ViewId,
          label: "대시보드 (Dashboard)",
          icon: LayoutDashboard,
          badge: undefined,
        },
      ],
    },
    {
      key: "workboard",
      label: "Workboard · 업무관리",
      items: [
        {
          id: "upload" as ViewId,
          label: "1. 자료 올리기",
          icon: UploadIcon,
          badge: undefined,
        },
        {
          id: "kanban" as ViewId,
          label: "2. 진행상태 (칸반 보드)",
          icon: KanbanIcon,
          badge: String(tasks.length),
        },
        {
          id: "report" as ViewId,
          label: "3. 주간업무보고서",
          icon: FileText,
          badge: delayedCount > 0 ? `${delayedCount}` : undefined,
        },
      ],
    },
    {
      key: "operations",
      label: "운영",
      items: [
        { id: "status" as ViewId, label: "제출 현황", icon: ClipboardCheck, badge: undefined },
        ...(currentUser.role === "관리자"
          ? [
              {
                id: "distribute" as ViewId,
                label: "배포 · 취합",
                icon: FileSpreadsheet,
                badge: undefined,
              },
              { id: "audit" as ViewId, label: "변경 이력", icon: History, badge: undefined },
            ]
          : []),
      ],
    },
    ...(currentUser.role === "관리자"
      ? [
          {
            key: "accounts",
            label: "계정관리",
            items: [
              {
                id: "members" as ViewId,
                label: "회원 관리",
                icon: Users,
                badge: String(users.length),
              },
              {
                id: "org" as ViewId,
                label: "조직도 관리",
                icon: Network,
                badge: String(departments.length),
              },
              {
                id: "positions" as ViewId,
                label: "직급 관리",
                icon: Award,
                badge: String(positions.length),
              },
            ],
          },
        ]
      : []),
  ];

  const SidebarContent = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <>
      {/* Zenith Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-xs">
          <Layers className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
              업무보고
            </span>
            <span className="truncate text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
              주간업무 보고서
            </span>
          </div>
        )}
      </div>

      {/* Zenith Navigation */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 space-y-4 overflow-y-auto px-3 py-4"
      >
        {navGroups.map((group) => {
          const isOpen = openGroups[group.key] ?? true;
          return (
            <div key={group.key}>
              {!isCollapsed && (
                <button
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.key]: !isOpen }))
                  }
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 transition-colors hover:text-sidebar-foreground/60 cursor-pointer"
                >
                  <span className="flex-1 text-start">{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "size-3 transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>
              )}
              {(isCollapsed || isOpen) && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveView(item.id);
                          setMobileOpen(false);
                        }}
                        aria-current={active ? "page" : undefined}
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            active
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
                          )}
                        />
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-start truncate">{item.label}</span>
                            {item.badge && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary/15 px-1.5 text-[10px] font-semibold text-sidebar-primary">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {isCollapsed && item.badge && (
                          <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-sidebar-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="my-2 border-t border-sidebar-border" />

        {/* Quick Actions */}
        <div className="space-y-0.5">
          <button
            onClick={() => {
              setCustomizerOpen(true);
              setMobileOpen(false);
            }}
            className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground cursor-pointer"
          >
            <Settings className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80" />
            {!isCollapsed && <span className="flex-1 text-start">테마 커스터마이저</span>}
          </button>
          <button
            onClick={() => {
              setNewTaskModalOpen(true);
              setMobileOpen(false);
            }}
            className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground cursor-pointer"
          >
            <Plus className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80" />
            {!isCollapsed && <span className="flex-1 text-start">새 업무 빠른 등록</span>}
          </button>
        </div>
      </nav>

      {/* Zenith Sidebar User Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary/80 to-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
              {currentUser.name.slice(0, 2)}
            </div>
            {!isCollapsed && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {currentUser.name}
                </span>
                <span className="truncate text-[11px] text-sidebar-foreground/50">
                  {departmentName(departments, currentUser)}
                  {positionName(positions, currentUser.position_id) &&
                    ` · ${positionName(positions, currentUser.position_id)}`}{" "}
                  · {currentUser.role}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              aria-label="로그아웃"
              title="로그아웃"
              className="rounded-md p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground/80 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "min-h-screen font-sans text-foreground transition-colors",
        container === "boxed"
          ? "mx-auto max-w-[1440px] border-x border-border bg-background shadow-sm"
          : "bg-background",
      )}
    >
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        {layout === "sidebar" && (
          <aside
            className={cn(
              "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out lg:flex",
              collapsed ? "w-[68px]" : "w-[260px]",
            )}
          >
            <SidebarContent isCollapsed={collapsed} />
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/60 shadow-sm transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
            >
              <ChevronLeft
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  collapsed && "rotate-180",
                )}
              />
            </button>
          </aside>
        )}

        {/* Mobile Sidebar Drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-in-out lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarContent isCollapsed={false} />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="사이드바 닫기"
            className="absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </aside>

        {/* Main Content Column */}
        <div
          className={cn(
            "flex flex-1 flex-col transition-all duration-300",
            layout === "sidebar" ? (collapsed ? "lg:ms-[68px]" : "lg:ms-[260px]") : "",
          )}
        >
          {/* Zenith Sticky Header */}
          <div className="sticky top-0 z-30">
            <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  aria-label="메뉴 열기"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden cursor-pointer"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <h1 className="text-base font-bold tracking-tight sm:hidden">업무관리 시스템</h1>

                {layout === "topnav" && (
                  <div className="hidden items-center gap-2.5 lg:flex">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                      <Layers className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold leading-none tracking-tight">업무보고</span>
                      <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                        주간업무 보고서
                      </span>
                    </div>
                    <div className="mx-1 h-6 w-px bg-border" />
                  </div>
                )}

                {/* Command Palette Trigger */}
                <button
                  onClick={() => setCmdOpen(true)}
                  className="relative hidden h-9 w-64 items-center rounded-lg border border-input bg-muted/40 ps-9 pe-4 text-start text-sm text-muted-foreground/60 transition-colors hover:bg-muted/70 sm:flex md:w-72 cursor-pointer"
                >
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <span>업무·메뉴 빠른 검색...</span>
                  <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    ⌘K
                  </kbd>
                </button>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2">
                {currentUser.role === "관리자" && (
                  <button
                    onClick={() => setActiveView("members")}
                    className="hidden h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent lg:inline-flex cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    <span>회원 등록</span>
                  </button>
                )}

                <button
                  onClick={() => setNewTaskModalOpen(true)}
                  className="hidden h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 sm:inline-flex cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>새 업무 등록</span>
                </button>

                <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

                {/* Theme Toggle */}
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="테마 전환"
                  title="라이트/다크 모드 전환"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                {/* Theme Customizer Button */}
                <button
                  onClick={() => setCustomizerOpen(true)}
                  aria-label="테마 커스터마이즈"
                  title="테마 커스터마이저"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>

                {/* Notifications Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifOpen(!notifOpen);
                      setUserMenuOpen(false);
                    }}
                    aria-label="알림"
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl z-50">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">업무 알림</p>
                          {unreadNotifCount > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                              {unreadNotifCount}
                            </span>
                          )}
                        </div>
                        {unreadNotifCount > 0 && (
                          <button
                            onClick={() =>
                              setActivities((prev) => prev.map((a) => ({ ...a, read: true })))
                            }
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <CheckCheck className="h-3 w-3" />
                            모두 읽음
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                        {activities.slice(0, 5).map((act) => (
                          <button
                            key={act.id}
                            onClick={() => {
                              setActivities((prev) =>
                                prev.map((a) => (a.id === act.id ? { ...a, read: true } : a)),
                              );
                              setNotifOpen(false);
                              setActiveView("kanban");
                            }}
                            className={cn(
                              "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-accent/50 cursor-pointer",
                              !act.read && "bg-primary/5",
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                act.type === "issue"
                                  ? "bg-destructive/15 text-destructive"
                                  : act.type === "complete"
                                    ? "bg-success/15 text-success"
                                    : "bg-chart-1/15 text-chart-1",
                              )}
                            >
                              {act.type === "issue" ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              ) : act.type === "complete" ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-xs",
                                  act.read
                                    ? "font-medium text-muted-foreground"
                                    : "font-semibold text-foreground",
                                )}
                              >
                                {act.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {act.description}
                              </p>
                              <p className="mt-1 text-[10px] text-muted-foreground/60">
                                {act.time}
                              </p>
                            </div>
                            {!act.read && (
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Profile Pill & Logout */}
                <div className="relative flex items-center gap-2">
                  <button
                    onClick={() => {
                      setUserMenuOpen(!userMenuOpen);
                      setNotifOpen(false);
                    }}
                    aria-label="사용자 메뉴"
                    className="ms-1 flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 ps-1 pe-2.5 text-xs font-medium transition-colors hover:bg-accent cursor-pointer"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {currentUser.name.slice(0, 2)}
                    </span>
                    <span className="hidden sm:inline">
                      <b>{currentUser.name}</b> 님 환영합니다
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>

                  <button
                    onClick={handleLogout}
                    className="hidden h-8 items-center rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex cursor-pointer"
                  >
                    로그아웃
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-10 w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl z-50">
                      <div className="px-2.5 py-2">
                        <p className="text-sm font-semibold">
                          {currentUser.name} ({currentUser.role})
                        </p>
                        <p className="text-xs text-muted-foreground">@{currentUser.username}</p>
                      </div>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setActiveView("members");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        회원 관리
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setCustomizerOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
                      >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        테마 및 레이아웃 설정
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Quick Navigation Sub-bar */}
            <nav
              aria-label="Quick view tabs"
              className={cn(
                "flex items-center justify-between gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6 overflow-x-auto",
                // 사이드바가 보이는 PC 화면에서는 사이드바와 중복되므로 숨김 (상단 메뉴 레이아웃에서는 유지)
                layout === "sidebar" && "lg:hidden",
              )}
            >
              <div className="flex items-center gap-1">
                {[
                  { id: "dashboard" as ViewId, label: "대시보드 (Overview)", icon: LayoutDashboard },
                  { id: "upload" as ViewId, label: "1. 자료 올리기", icon: UploadIcon },
                  { id: "kanban" as ViewId, label: "2. 진행상태 (칸반 보드)", icon: KanbanIcon },
                  { id: "report" as ViewId, label: "3. 주간업무보고서", icon: FileText },
                  { id: "status" as ViewId, label: "제출 현황", icon: ClipboardCheck },
                  ...(currentUser.role === "관리자"
                    ? [
                        { id: "distribute" as ViewId, label: "배포 · 취합", icon: FileSpreadsheet },
                        { id: "audit" as ViewId, label: "변경 이력", icon: History },
                        { id: "members" as ViewId, label: "회원 관리", icon: Users },
                        { id: "org" as ViewId, label: "조직도 관리", icon: Network },
                        { id: "positions" as ViewId, label: "직급 관리", icon: Award },
                      ]
                    : []),
                ].map((tabItem) => {
                  const Icon = tabItem.icon;
                  const active = activeView === tabItem.id;
                  return (
                    <button
                      key={tabItem.id}
                      onClick={() => setActiveView(tabItem.id)}
                      className={cn(
                        "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
                        active
                          ? "border-primary text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tabItem.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground lg:flex">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      supabaseConnected ? "bg-success" : "bg-warning",
                    )}
                  />
                  Supabase ({SUPABASE_PROJECT_REF}) 연동됨
                </span>
              </div>
            </nav>
          </div>

          {/* Main Workspace Area */}
          <main
            id="main-content"
            className="flex-1 p-4 sm:p-6 lg:px-8 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[1760px]"
          >
            {activeView === "dashboard" && (
              <ZenithDashboardOverview
                tasks={tasks}
                activities={activities}
                onNavigate={setActiveView}
                onOpenNewTask={() => setNewTaskModalOpen(true)}
                onStatusChange={async (id, status) => {
                  let updated: Task | undefined;
                  setTasks((prev) =>
                    prev.map((t) => {
                      if (t.id === id) {
                        updated = { ...t, status };
                        return updated;
                      }
                      return t;
                    }),
                  );
                  notify(`업무 상태가 '${status}'(으)로 변경되었습니다.`);
                  if (updated) await syncTaskToSupabase(updated);
                }}
              />
            )}
            {activeView === "upload" && (
              <UploadView
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                onApply={handleAddTasks}
                onNavigate={setActiveView}
                notify={notify}
              />
            )}
            {activeView === "kanban" && (
              <KanbanView
                tasks={tasks}
                setTasks={setTasks}
                users={users}
                notify={notify}
                onOpenNewTask={() => setNewTaskModalOpen(true)}
                onSyncTask={syncTaskToSupabase}
                onSaveTask={saveTask}
              />
            )}
            {activeView === "report" && (
              <ReportView tasks={tasks} currentUser={currentUser} notify={notify} />
            )}
            {activeView === "status" && (
              <SubmissionStatusView
                users={users}
                departments={departments}
                currentUser={currentUser}
                notify={notify}
              />
            )}
            {activeView === "distribute" && (
              <DistributionView
                users={users}
                departments={departments}
                notify={notify}
                onApplied={(merged) => {
                  setTasks((prev) => {
                    const byId = new Map(merged.map((t) => [t.id, t]));
                    const kept = prev.map((t) => byId.get(t.id) ?? t);
                    const added = merged.filter((t) => !prev.some((p) => p.id === t.id));
                    return [...added, ...kept];
                  });
                  addActivity({
                    type: "upload",
                    title: "배포 파일 취합 반영",
                    description: `${merged.length}건의 업무가 취합 파일로 갱신되었습니다.`,
                  });
                }}
              />
            )}
            {activeView === "audit" && <AuditLogView notify={notify} />}
            {activeView === "members" && (
              <AdminUserManagementView
                users={users}
                setUsers={setUsers}
                departments={departments}
                positions={positions}
                currentUser={currentUser}
                notify={notify}
                onActivity={(title, description) =>
                  addActivity({ type: "report", title, description })
                }
              />
            )}
            {activeView === "org" && (
              <OrgChartView
                departments={departments}
                setDepartments={setDepartments}
                users={users}
                setUsers={setUsers}
                notify={notify}
                onActivity={(title, description) =>
                  addActivity({ type: "report", title, description })
                }
              />
            )}
            {activeView === "positions" && (
              <PositionsView
                positions={positions}
                setPositions={setPositions}
                users={users}
                notify={notify}
                onActivity={(title, description) =>
                  addActivity({ type: "report", title, description })
                }
              />
            )}
          </main>
        </div>
      </div>

      {/* Global New Task Modal */}
      {newTaskModalOpen && (
        <NewTaskModal
          onClose={() => setNewTaskModalOpen(false)}
          onCreate={async (newTask) => {
            setTasks((prev) => [newTask, ...prev]);
            addActivity({
              type: newTask.status === "지연 / 이슈" ? "issue" : "task",
              title: "새 업무 등록됨",
              description: `${newTask.owner || "담당자"} — ${newTask.title} (${newTask.field})`,
            });
            setNewTaskModalOpen(false);
            notify("새 업무가 등록되었습니다.");
            await syncTaskToSupabase(newTask);
          }}
          notify={notify}
        />
      )}

      {/* Zenith Command Palette Modal (⌘K) */}
      {cmdOpen && (
        <CommandPaletteModal
          tasks={tasks}
          onClose={() => setCmdOpen(false)}
          onSelectView={(v) => {
            setActiveView(v);
            setCmdOpen(false);
          }}
          onNewTask={() => {
            setCmdOpen(false);
            setNewTaskModalOpen(true);
          }}
          onToggleTheme={() => {
            setTheme(theme === "dark" ? "light" : "dark");
            setCmdOpen(false);
          }}
          onLogout={() => {
            setCmdOpen(false);
            handleLogout();
          }}
        />
      )}

      {/* Zenith Live Theme Customizer Sheet */}
      {customizerOpen && (
        <ThemeCustomizerDrawer
          theme={theme}
          setTheme={setTheme}
          colorPreset={colorPreset}
          setColorPreset={setColorPreset}
          density={density}
          setDensity={setDensity}
          layout={layout}
          setLayout={setLayout}
          container={container}
          setContainer={setContainer}
          onReset={() => {
            setTheme("light");
            setColorPreset("neutral");
            setDensity("comfortable");
            setLayout("sidebar");
            setContainer("fluid");
            notify("기본 테마 설정으로 초기화되었습니다.");
          }}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <Sparkles className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 0. SUPABASE LOGIN SCREEN (회원가입은 관리자가 직접 수동등록으로 진행)
 * ============================================================================ */
export function Login({
  onLoginSuccess,
}: {
  onLoginSuccess: (user: AppUser) => void;
}) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const trimmedId = id.trim().toLowerCase();
    if (!trimmedId || !pw) {
      return setErr("아이디와 비밀번호를 입력해주세요.");
    }
    if (!USERNAME_PATTERN.test(trimmedId)) {
      return setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    setLoading(true);
    try {
      // 아이디로 Supabase Auth 로그인 — 비밀번호 검증은 서버에서만 수행
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: usernameToAuthEmail(trimmedId),
        password: pw,
      });

      if (!authErr && authData?.user) {
        const profile = await fetchProfile(authData.user.id);
        if (!profile) {
          await supabase.auth.signOut();
          return setErr("등록되지 않은 계정입니다. 관리자에게 문의하세요.");
        }
        if (!profile.is_active) {
          await supabase.auth.signOut();
          return setErr("비활성화된 계정입니다. 관리자에게 문의하세요.");
        }
        return onLoginSuccess(profile);
      }

      setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    } catch {
      setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 font-sans">
      <ZenithCard className="w-full max-w-md p-6 sm:p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-xs">
              <Layers className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight">업무보고</span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                주간업무 보고서
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Supabase 연동
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight">업무관리 시스템 로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          주간업무보고 및 칸반 관리 시스템입니다.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium">아이디</label>
            <input
              className={inputCls}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: admin"
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">비밀번호</label>
            <input
              type="password"
              className={inputCls}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••"
              autoComplete="current-password"
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className={cn(btnPrimary, "w-full", loading && "opacity-70")}
          >
            {loading ? "Supabase 인증 확인 중..." : "로그인"}
          </button>

          {/* Admin-only manual registration policy notice */}
          <div className="rounded-lg border border-border bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span>회원가입 안내 (관리자 수동 등록 전용)</span>
            </div>
            <p className="leading-relaxed">
              본 시스템은 보안 정책상 자체 회원가입을 지원하지 않으며,{" "}
              <b>관리자가 [계정관리 › 회원 관리] 메뉴에서 직접 계정을 발급</b>합니다.
            </p>
            <p className="pt-1 text-center font-medium text-foreground">
              관리자 아이디: <code className="rounded bg-background px-1.5 py-0.5">admin</code>
            </p>
          </div>
        </form>
      </ZenithCard>
    </div>
  );
}

/* ============================================================================
 * 1. ZENITH DASHBOARD OVERVIEW PAGE
 * ============================================================================ */
function ZenithDashboardOverview({
  tasks,
  activities,
  onNavigate,
  onOpenNewTask,
  onStatusChange,
}: {
  tasks: Task[];
  activities: ActivityItem[];
  onNavigate: (view: ViewId) => void;
  onOpenNewTask: () => void;
  onStatusChange: (id: string, status: Status) => void;
}) {
  const [chartTab, setChartTab] = useState<"추진 실적" | "분야별 건수" | "완료율 추이">("추진 실적");

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "완료").length;
  const inProgressCount = tasks.filter((t) => t.status === "진행 중").length;
  const delayedCount = tasks.filter((t) => t.status === "지연 / 이슈").length;
  const completionRate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const kpiCards = [
    {
      key: "total",
      title: "전체 등록 업무 (Total Tasks)",
      value: `${totalCount}건`,
      change: 12.5,
      changeLabel: "전주 대비",
      icon: Layers,
      color: "text-chart-1",
      bg: "bg-chart-1/10",
      stroke: "var(--chart-1)",
      sparkline: [3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, totalCount || 5],
    },
    {
      key: "completed",
      title: "완료 업무 (Completed)",
      value: `${completedCount}건 (${completionRate}%)`,
      change: 8.2,
      changeLabel: "목표 달성률",
      icon: CheckCircle2,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
      stroke: "var(--chart-2)",
      sparkline: [1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 4, Math.max(1, completedCount)],
    },
    {
      key: "progress",
      title: "진행 중 업무 (In Progress)",
      value: `${inProgressCount}건`,
      change: 14.0,
      changeLabel: "정상 추진 중",
      icon: Clock,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
      stroke: "var(--chart-3)",
      sparkline: [2, 2, 3, 2, 3, 4, 3, 3, 4, 3, 4, Math.max(1, inProgressCount)],
    },
    {
      key: "delayed",
      title: "지연 / 이슈 (Delayed & Issues)",
      value: `${delayedCount}건`,
      change: delayedCount > 0 ? -3.1 : 0,
      changeLabel: delayedCount > 0 ? "집중 점검 필요" : "이슈 없음",
      icon: AlertTriangle,
      color: "text-chart-4",
      bg: "bg-chart-4/10",
      stroke: "var(--chart-4)",
      sparkline: [2, 3, 2, 2, 1, 2, 1, 2, 1, 1, 2, delayedCount],
    },
  ];

  const fieldDistribution = useMemo(() => {
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-5)",
    ];
    return FIELDS.map((field, idx) => {
      const list = tasks.filter((t) => t.field === field);
      const count = list.length;
      const doneCount = list.filter((t) => t.status === "완료" || t.status === "진행 중").length;
      const pct = totalCount ? Math.round((count / totalCount) * 100) : 25;
      return {
        name: field,
        count,
        doneCount,
        value: pct,
        color: colors[idx % colors.length]!,
      };
    });
  }, [tasks, totalCount]);

  const fieldGoals = useMemo(() => {
    const barColors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-5"];
    return FIELDS.map((field, idx) => {
      const list = tasks.filter((t) => t.field === field);
      const activeOrDone = list.filter(
        (t) => t.status === "완료" || t.status === "진행 중",
      ).length;
      const target = Math.max(list.length, 2);
      return {
        label: field,
        current: activeOrDone,
        target,
        color: barColors[idx % barColors.length]!,
      };
    });
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드 (Dashboard)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            주간업무보고 및 부서별 업무 추진 현황을 실시간으로 모니터링합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onNavigate("members")} className={btnOutline}>
            <UserPlus className="h-4 w-4 text-primary" />
            <span>회원 등록</span>
          </button>
          <button onClick={() => onNavigate("upload")} className={btnOutline}>
            <FileSpreadsheet className="h-4 w-4" />
            <span>엑셀 자료 올리기</span>
          </button>
          <button onClick={onOpenNewTask} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            <span>새 업무 등록</span>
          </button>
        </div>
      </div>

      {/* Row 1: 4 Zenith KPI Cards with Area Sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isPositive = card.change >= 0;
          const sparkData = card.sparkline.map((v, i) => ({ idx: i, v }));
          return (
            <ZenithCard
              key={card.key}
              className="group relative overflow-hidden transition-all duration-300 hover:border-primary/20 hover:shadow-md"
            >
              <div className="p-5 pb-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                    <div className="flex items-center gap-1.5">
                      {isPositive ? (
                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isPositive ? "text-success" : "text-destructive",
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {card.change}%
                      </span>
                      <span className="text-xs text-muted-foreground">{card.changeLabel}</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                      card.bg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", card.color)} />
                  </div>
                </div>
              </div>
              <div className="h-12 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.stroke} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={card.stroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={card.stroke}
                      strokeWidth={1.5}
                      fill={`url(#grad-${card.key})`}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ZenithCard>
          );
        })}
      </div>

      {/* Row 2: Overview Chart (col-8) + Field Distribution & Goals (col-4) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Overview · 업무 추진 추이</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                월별/주차별 업무 완료 실적 및 분야별 등록 건수
              </p>
            </div>
            <div className="flex items-center gap-1 self-start rounded-lg bg-muted p-0.5">
              {(["추진 실적", "분야별 건수", "완료율 추이"] as const).map((tabName) => (
                <button
                  key={tabName}
                  onClick={() => setChartTab(tabName)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    chartTab === tabName
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tabName}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === "분야별 건수" ? (
                <BarChart data={fieldDistribution} barCategoryGap="25%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.6}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="등록 건수"
                    fill="var(--chart-3)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              ) : (
                <AreaChart data={MONTHLY_TREND_DATA}>
                  <defs>
                    <linearGradient id="overviewGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="overviewGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.6}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={(v) => (chartTab === "완료율 추이" ? `${v}%` : `${v}건`)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartTab === "추진 실적" ? "completed" : "rate"}
                    name={chartTab === "추진 실적" ? "완료 업무 (건)" : "완료율 (%)"}
                    stroke={chartTab === "추진 실적" ? "var(--chart-1)" : "var(--chart-2)"}
                    strokeWidth={2}
                    fill={
                      chartTab === "추진 실적"
                        ? "url(#overviewGrad1)"
                        : "url(#overviewGrad2)"
                    }
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)" }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </ZenithCard>

        {/* Right Column: Donut Chart + Goals Progress */}
        <div className="col-span-full flex flex-col gap-4 xl:col-span-4">
          <ZenithCard className="p-6">
            <div className="pb-3">
              <h2 className="text-base font-semibold">분야별 업무 비중</h2>
              <p className="text-xs text-muted-foreground">4대 관리 분야별 등록 업무 분포</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fieldDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="count"
                      strokeWidth={0}
                    >
                      {fieldDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{totalCount}건</span>
                  <span className="text-[10px] text-muted-foreground">전체 업무</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {fieldDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold">
                      {item.count}건 ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ZenithCard>

          <ZenithCard className="flex-1 p-6">
            <div className="pb-4">
              <h2 className="text-base font-semibold">분야별 추진 달성률</h2>
              <p className="text-xs text-muted-foreground">완료 및 정상 진행 업무 비율</p>
            </div>
            <div className="space-y-4">
              {fieldGoals.map((goal) => {
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <div key={goal.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{goal.label}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", goal.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>추진/완료: {goal.current}건</span>
                      <span>등록 목표: {goal.target}건</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ZenithCard>
        </div>
      </div>

      {/* Row 3: Recent Tasks Table (col-8) + Recent Activity Feed (col-4) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="flex flex-row items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-semibold">최근 업무 현황 (Recent Tasks)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                부서원별 담당 업무 및 실시간 진행 상태
              </p>
            </div>
            <button
              onClick={() => onNavigate("kanban")}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 cursor-pointer"
            >
              <span>칸반 보드 보기</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    담당자 / 분야
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    코드
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    업무명 · 추진현황
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    상태
                  </th>
                  <th className="pb-3 text-end text-xs font-medium text-muted-foreground">
                    기한
                  </th>
                  <th className="pb-3 text-end text-xs font-medium text-muted-foreground">
                    <span className="sr-only">상태 변경</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 7).map((t, idx) => (
                  <tr
                    key={t.id}
                    className="group border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white",
                            AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                          )}
                        >
                          {t.owner.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.owner}</p>
                          <p className="text-xs text-muted-foreground">{t.field}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.code || `TSK-100${idx + 1}`}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.progress || "추진현황 미입력"}
                        {t.issue ? ` · ⚠ ${t.issue}` : ""}
                      </p>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          statusBadgeStyle[t.status],
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-end">
                      <span className="text-xs font-semibold text-foreground">{t.due}</span>
                    </td>
                    <td className="py-3.5 pl-2 text-end">
                      <select
                        aria-label={`${t.title} 상태 변경`}
                        value={t.status}
                        onChange={(e) => onStatusChange(t.id, e.target.value as Status)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ZenithCard>

        <ZenithCard className="col-span-full xl:col-span-4 p-6">
          <div className="flex flex-row items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-semibold">최근 활동 (Recent Activity)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                실시간 업무 업데이트 및 이슈 내역
              </p>
            </div>
            <button
              onClick={() => onNavigate("report")}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 cursor-pointer"
            >
              <span>보고서 보기</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-0">
            {activities.slice(0, 6).map((act) => {
              const iconMap = {
                issue: {
                  icon: AlertTriangle,
                  color: "text-destructive",
                  bg: "bg-destructive/10",
                },
                complete: {
                  icon: CheckCircle2,
                  color: "text-chart-2",
                  bg: "bg-chart-2/10",
                },
                task: {
                  icon: Clock,
                  color: "text-chart-1",
                  bg: "bg-chart-1/10",
                },
                upload: {
                  icon: FileSpreadsheet,
                  color: "text-chart-3",
                  bg: "bg-chart-3/10",
                },
                report: {
                  icon: UserPlus,
                  color: "text-chart-5",
                  bg: "bg-chart-5/10",
                },
              };
              const cfg = iconMap[act.type];
              const ActIcon = cfg.icon;
              return (
                <div
                  key={act.id}
                  className="group flex gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/30"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      cfg.bg,
                    )}
                  >
                    <ActIcon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium leading-snug">{act.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {act.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">{act.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ZenithCard>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. UPLOAD VIEW (Excel/CSV Drag & Drop + Text Paste)
 * ============================================================================ */
// 파일의 시트마다 머리글로 열을 찾아 읽음 — 「지난주」 이름의 시트는 지난주 자료로 분류
async function readFile(file: File) {
  const XLSX = await import("xlsx");
  const cur: Draft[] = [];
  const prev: Draft[] = [];
  let headerSheets = 0;
  let sheets = 0;
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  for (const name of wb.SheetNames) {
    // 양식의 「작성 안내」 시트(예시 행 포함)는 읽지 않음
    if (name.includes("안내")) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: "",
    });
    const parsed = rowsToDrafts(rows.map((r) => r.map((c) => String(c).replace(/[\t\n]/g, " "))));
    if (parsed.drafts.length === 0) continue;
    sheets++;
    if (parsed.headerDetected) headerSheets++;
    (name.includes("지난주") ? prev : cur).push(...parsed.drafts);
  }
  return { cur, prev, sheets, headerSheets };
}

// 올린 파일 1개 (upload_files 테이블)
type UploadFile = {
  id: string;
  file_name: string;
  kind: "current" | "prev";
  week_start: string;
  rows: Draft[];
  uploaded_by: string | null;
  uploaded_by_name: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};
type SheetRow = [string, string, string, string, string, string, string];

const JEXCEL_COLUMNS = [
  { col: "A", label: "분야", width: "w-[125px]" },
  { col: "B", label: "업무명", width: "min-w-[160px]" },
  { col: "C", label: "담당자", width: "w-[88px]" },
  { col: "D", label: "기한", width: "w-[115px]" },
  { col: "E", label: "상태", width: "w-[100px]" },
  { col: "F", label: "추진현황", width: "min-w-[140px]" },
  { col: "G", label: "이슈", width: "min-w-[120px]" },
] as const;

const createEmptySheetRows = (count = 8): SheetRow[] =>
  Array.from({ length: count }, () => ["", "", "", "", "", "", ""]);

function tasksToSheetRows(list: Draft[], minRows = 8): SheetRow[] {
  const mapped: SheetRow[] = list.map((t) => [
    t.field,
    t.title,
    t.owner,
    t.due,
    t.status,
    t.progress,
    t.issue,
  ]);
  while (mapped.length < minRows) {
    mapped.push(["", "", "", "", "", "", ""]);
  }
  return mapped;
}

// 엑셀표는 열 순서가 고정(분야·업무명·담당자·기한·상태·추진현황·이슈)
function sheetRowsToDrafts(rows: SheetRow[]): Draft[] {
  return rows
    .map(([field, title, owner, due, status, progress, issue]) => ({
      field: field.trim(),
      title: title.trim(),
      owner: owner.trim(),
      due: normalizeDate(due),
      status: status.trim(),
      progress: progress.trim(),
      issue: issue.trim(),
    }))
    .filter((d) => d.title !== "" && d.title !== "업무명");
}

function DropZone({
  title,
  hint,
  onFiles,
}: {
  title: string;
  hint: string;
  onFiles: (f: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  const handle = (list: FileList | null) => {
    const f = Array.from(list ?? []).filter((x) => /\.(xlsx|xls|csv)$/i.test(x.name));
    if (!f.length) return;
    // 여러 문서를 순차적으로 또는 동시에 드래그앤드롭해도 누적 등록되도록 처리
    setNames((prev) => [...prev, ...f.map((x) => x.name)]);
    onFiles(f);
  };

  return (
    <ZenithCard className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {names.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              등록 문서 {names.length}개
            </span>
          )}
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          .xlsx · .xls · .csv
        </span>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "mt-3.5 flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200",
          over
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40",
        )}
      >
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <p className="mt-2.5 text-sm font-medium">
          업무일지 파일을 끌어다 놓거나 눌러서 고르세요 (다중 파일 누적 등록 가능)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </label>
      {names.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {names.map((n, idx) => (
            <span
              key={`${n}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
            >
              <span>📄</span>
              <span className="font-medium">{n}</span>
              <button
                type="button"
                onClick={() => setNames((prev) => prev.filter((_, i) => i !== idx))}
                className="ms-0.5 rounded text-muted-foreground hover:text-destructive cursor-pointer"
                aria-label={`${n} 목록에서 제거`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </ZenithCard>
  );
}

/* Jexcel / Jspreadsheet 스타일 인터랙티브 엑셀 시트 컴포넌트 */
function JexcelSheet({
  title,
  subtitle,
  rows,
  setRows,
}: {
  title: string;
  subtitle: string;
  rows: SheetRow[];
  setRows: React.Dispatch<React.SetStateAction<SheetRow[]>>;
}) {
  const [activeCell, setActiveCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  const updateCell = (rIdx: number, cIdx: number, val: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rIdx) return row;
        const copy = [...row] as SheetRow;
        copy[cIdx] = val;
        return copy;
      }),
    );
  };

  // 엑셀에서 여러 행·열 복사(Ctrl+C) 후 시트 내 아무 셀에서나 붙여넣기(Ctrl+V) 처리
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>,
    startR: number,
    startC: number,
  ) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!raw || (!raw.includes("\t") && !raw.includes("\n"))) return;
    e.preventDefault();

    const pastedLines = raw
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0)
      .map((l) => l.split(/\t|\|/).map((c) => c.trim()))
      .filter((cols) => !(cols[0] === "분야" && cols[1] === "업무명"));

    if (!pastedLines.length) return;

    setRows((prev) => {
      const neededRows = Math.max(prev.length, startR + pastedLines.length + 1);
      const next: SheetRow[] = Array.from({ length: neededRows }, (_, idx) =>
        prev[idx] ? ([...prev[idx]] as SheetRow) : ["", "", "", "", "", "", ""],
      );

      pastedLines.forEach((cols, rOffset) => {
        const targetR = startR + rOffset;
        // 만약 사용자가 B열 등 중간 셀이 아니라 단일 줄 전체(7열)를 붙여넣었다면 A열(0)부터 채움
        const baseC = cols.length >= 4 && startC > 1 ? 0 : startC;
        cols.forEach((val, cOffset) => {
          const targetC = baseC + cOffset;
          if (targetC < 7) {
            next[targetR]![targetC] = val;
          }
        });
      });
      return next;
    });
  };

  const filledCount = useMemo(() => sheetRowsToDrafts(rows).length, [rows]);
  const activeCoord = `${JEXCEL_COLUMNS[activeCell.c]?.col ?? "A"}${activeCell.r + 1}`;
  const activeVal = rows[activeCell.r]?.[activeCell.c] ?? "";

  const fillSampleRows = () => {
    setRows([
      [
        "복리후생/총무",
        "사내 동호회 하반기 지원금 정산",
        "홍길동",
        "2026-11-14",
        "진행 중",
        "영수증 취합 및 검토 중",
        "",
      ],
      [
        "자산",
        "노후 사무용 의자 교체 수요조사",
        "김민지",
        "2026-11-18",
        "대기",
        "부서별 수량 파악 중",
        "예산 추가 배정 필요",
      ],
      ...createEmptySheetRows(6),
    ]);
  };

  return (
    <ZenithCard className="overflow-hidden p-0">
      {/* Jexcel Sheet Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
              JEXCEL
            </span>
            <h3 className="text-sm font-bold">{title}</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={fillSampleRows}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            샘플 채우기
          </button>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, ["", "", "", "", "", "", ""]])}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            + 행 추가
          </button>
          <button
            type="button"
            onClick={() => setRows(createEmptySheetRows(8))}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            비우기
          </button>
          <span className="rounded-md bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            입력 {filledCount}건
          </span>
        </div>
      </div>

      {/* Jexcel Formula / Coordinate Bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5 text-xs">
        <span className="inline-flex w-10 items-center justify-center rounded border border-border bg-background py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          {activeCoord}
        </span>
        <span className="font-mono text-xs italic text-muted-foreground">fx</span>
        <input
          value={activeVal}
          onChange={(e) => updateCell(activeCell.r, activeCell.c, e.target.value)}
          placeholder="셀을 클릭하여 직접 입력하거나 엑셀에서 복사(Ctrl+C) 후 붙여넣기(Ctrl+V) 하세요"
          className="flex-1 bg-transparent text-xs outline-none"
        />
      </div>

      {/* Jexcel Spreadsheet Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/80 text-muted-foreground select-none">
              <th className="w-9 border-b border-r border-border py-1.5 text-center font-mono text-[11px] font-semibold">
                #
              </th>
              {JEXCEL_COLUMNS.map((col, cIdx) => {
                const isSelectedCol = activeCell.c === cIdx;
                return (
                  <th
                    key={col.col}
                    className={cn(
                      "border-b border-r border-border last:border-r-0 px-2 py-1.5 text-center font-semibold transition-colors",
                      col.width,
                      isSelectedCol &&
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    <span className="font-mono text-[10px] opacity-60 me-1">{col.col}</span>
                    <span>{col.label}</span>
                  </th>
                );
              })}
              <th className="w-10 border-b border-l border-border py-1.5 text-center font-semibold">
                삭제
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              const isSelectedRow = activeCell.r === rIdx;
              return (
                <tr key={rIdx} className="group">
                  {/* Row Number Header */}
                  <td
                    className={cn(
                      "border-b border-r border-border bg-muted/60 text-center font-mono text-[11px] text-muted-foreground select-none",
                      isSelectedRow &&
                        "bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {rIdx + 1}
                  </td>

                  {/* 7 Editable Jexcel Cells */}
                  {row.map((cellVal, cIdx) => {
                    const isFocused = activeCell.r === rIdx && activeCell.c === cIdx;
                    return (
                      <td
                        key={cIdx}
                        className={cn(
                          "relative border-b border-r border-border last:border-r-0 p-0 transition-colors",
                          isFocused
                            ? "bg-emerald-500/5 ring-2 ring-inset ring-emerald-600 z-10"
                            : "bg-card hover:bg-muted/20",
                        )}
                      >
                        <input
                          value={cellVal}
                          onFocus={() => setActiveCell({ r: rIdx, c: cIdx })}
                          onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                          onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                          list={
                            cIdx === 0
                              ? "jexcel-fields-list"
                              : cIdx === 4
                                ? "jexcel-status-list"
                                : undefined
                          }
                          placeholder={
                            rIdx === 0
                              ? cIdx === 0
                                ? "복리후생/총무"
                                : cIdx === 1
                                  ? "업무명 입력/붙여넣기"
                                  : cIdx === 2
                                    ? "홍길동"
                                    : cIdx === 3
                                      ? "2026-11-15"
                                      : cIdx === 4
                                        ? "진행 중"
                                        : ""
                              : ""
                          }
                          className="h-8 w-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/35"
                        />
                      </td>
                    );
                  })}
                  {/* 행 삭제 (항상 표시) */}
                  <td className="border-b border-l border-border text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => {
                          const next = prev.filter((_, i) => i !== rIdx);
                          return next.length ? next : createEmptySheetRows(1);
                        })
                      }
                      aria-label={`${rIdx + 1}행 삭제`}
                      title="행 삭제"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Datalist suggestions for Field & Status columns */}
        <datalist id="jexcel-fields-list">
          {FIELDS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <datalist id="jexcel-status-list">
          {STATUSES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </ZenithCard>
  );
}

const STATUS_SOURCE_STYLE: Record<RowAnalysis["statusSource"], string> = {
  입력: "border-border bg-muted text-muted-foreground",
  추정: "border-primary/25 bg-primary/10 text-primary",
  기본값: "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning",
  "기존 유지": "border-border bg-card text-muted-foreground",
  "마감 초과": "border-destructive/30 bg-destructive/10 text-destructive",
};

const UPLOAD_FIELD_LABELS: Record<string, string> = {
  field: "분야",
  owner: "담당자",
  due: "기한",
  status: "상태",
  progress: "추진현황",
  issue: "이슈",
};

function UploadView({
  tasks,
  users,
  currentUser,
  onApply,
  onNavigate,
  notify,
}: {
  tasks: Task[];
  users: AppUser[];
  currentUser: AppUser;
  onApply: (t: Task[]) => Promise<boolean>;
  onNavigate: (v: ViewId) => void;
  notify: (m: string) => void;
}) {
  const thisWeek = weekStartOf();
  const [files, setFiles] = useState<UploadFile[] | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorRows, setEditorRows] = useState<SheetRow[]>(() => createEmptySheetRows(8));
  const [editorDirty, setEditorDirty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [myAuthId, setMyAuthId] = useState<string | null>(null);
  const [markOverdue, setMarkOverdue] = useState(true);
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const [applying, setApplying] = useState(false);
  // 지난주 엑셀표가 비어 있으면 지난주 확정 보고서(DB)를 비교 기준으로 사용
  const [lastConfirmed, setLastConfirmed] = useState<TaskLike[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("weekly_reports")
      .select("snapshot")
      .eq("week_start", addWeeks(weekStartOf(), -1))
      .maybeSingle()
      .then(({ data }) => {
        const snap = (data as { snapshot?: unknown } | null)?.snapshot;
        if (alive && Array.isArray(snap)) setLastConfirmed(snap as TaskLike[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 올린 파일 목록 (최근 4주) — 이번 주 미반영 파일은 처음부터 반영 대상으로 체크
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setMyAuthId(data.session?.user.id ?? null);
    });
    supabase
      .from("upload_files")
      .select("*")
      .gte("week_start", addWeeks(thisWeek, -3))
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        const list = error || !Array.isArray(data) ? [] : (data as UploadFile[]);
        setFiles(list);
        setIncluded(
          new Set(
            list
              .filter((f) => f.kind === "current" && f.week_start === thisWeek && !f.applied_at)
              .map((f) => f.id),
          ),
        );
      });
    return () => {
      alive = false;
    };
  }, [thisWeek]);

  const canModify = (f: UploadFile) => currentUser.role === "관리자" || f.uploaded_by === myAuthId;

  const insertFile = async (fileName: string, kind: UploadFile["kind"], rows: Draft[]) => {
    const { data, error } = await supabase
      .from("upload_files")
      .insert({
        file_name: fileName,
        kind,
        week_start: thisWeek,
        rows,
        uploaded_by_name: currentUser.name,
      })
      .select("*")
      .single();
    if (error || !data) {
      notify(`파일 저장 실패: ${error?.message ?? "알 수 없는 오류"}`);
      return null;
    }
    const saved = data as UploadFile;
    setFiles((prev) => [saved, ...(prev ?? [])]);
    if (kind === "current") setIncluded((prev) => new Set(prev).add(saved.id));
    return saved;
  };

  // 파일은 바로 업무로 반영하지 않고 「올린 파일」 목록에 저장 → 분석 확인 후 반영
  const run = async (picked: File[], forcePrev: boolean) => {
    let total = 0;
    for (const file of picked) {
      try {
        const { cur, prev, sheets, headerSheets } = await readFile(file);
        const toPrev = forcePrev ? [...cur, ...prev] : prev;
        const toCur = forcePrev ? [] : cur;
        if (!toCur.length && !toPrev.length) {
          notify(`'${file.name}'에서 업무 행을 찾지 못했습니다.`);
          continue;
        }
        if (toCur.length) await insertFile(file.name, "current", toCur);
        if (toPrev.length)
          await insertFile(toCur.length ? `${file.name} (지난주 시트)` : file.name, "prev", toPrev);
        total += toCur.length + toPrev.length;
        if (headerSheets < sheets) {
          notify(
            `'${file.name}': 머리글 없는 시트 ${sheets - headerSheets}개는 기본 열 순서로 읽었습니다.`,
          );
        }
      } catch {
        notify(`'${file.name}' 파일을 읽지 못했습니다.`);
      }
    }
    if (total)
      notify(`${total}건을 읽어 올린 파일 목록에 저장했습니다. 분석 결과를 확인 후 반영하세요.`);
  };

  const createBlankSheet = async () => {
    const now = new Date();
    const label = `직접 입력 ${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const saved = await insertFile(label, "current", []);
    if (saved) openEditor(saved);
  };

  const openEditor = (f: UploadFile) => {
    if (editorDirty && editingId !== f.id) {
      notify("저장하지 않은 수정 내용이 있습니다. 먼저 저장하거나 닫아주세요.");
      return;
    }
    setEditingId(f.id);
    setEditorRows(tasksToSheetRows(f.rows, 8));
    setEditorDirty(false);
  };

  const saveEditor = async () => {
    if (!editingId) return;
    const rows = sheetRowsToDrafts(editorRows);
    const ok = await runDb(
      supabase.from("upload_files").update({ rows }).eq("id", editingId),
      notify,
      "파일 내용 저장 실패",
    );
    if (!ok) return;
    const now = new Date().toISOString();
    setFiles((prev) =>
      (prev ?? []).map((f) => (f.id === editingId ? { ...f, rows, updated_at: now } : f)),
    );
    setEditorDirty(false);
    notify(`파일 내용을 저장했습니다 (${rows.length}건).`);
  };

  const deleteFile = async (f: UploadFile) => {
    const ok = await runDb(
      supabase.from("upload_files").delete().eq("id", f.id),
      notify,
      "파일 삭제 실패",
    );
    if (!ok) return;
    setFiles((prev) => (prev ?? []).filter((x) => x.id !== f.id));
    setIncluded((prev) => {
      const next = new Set(prev);
      next.delete(f.id);
      return next;
    });
    if (editingId === f.id) setEditingId(null);
    setConfirmDeleteId(null);
    notify(
      f.applied_at
        ? `'${f.file_name}' 파일을 목록에서 삭제했습니다. 이미 반영된 업무는 그대로 남습니다.`
        : `'${f.file_name}' 파일을 삭제했습니다.`,
    );
  };

  // 업무일지 양식: 「업무일지」 시트는 머리글만, 「작성 안내」 시트에 규칙·예시·선택값
  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const header = DRAFT_KEYS.map((k) => TEMPLATE_HEADERS[k]);
      const sheet = XLSX.utils.aoa_to_sheet([header]);
      sheet["!cols"] = DRAFT_KEYS.map((k) => ({
        wch: k === "title" || k === "progress" || k === "issue" ? 36 : 14,
      }));

      const fields = fieldsOf(tasks, FIELDS);
      const members = users.filter((u) => u.is_active).map((u) => u.name);
      const guide = XLSX.utils.aoa_to_sheet([
        ["주간업무 업무일지 작성 안내"],
        [],
        [
          "1. 「업무일지」 시트의 첫 줄(머리글)은 지우거나 바꾸지 말고, 둘째 줄부터 한 업무씩 입력하세요.",
        ],
        ["2. 업무명은 꼭 입력하세요. 업무명이 빈 행은 읽지 않습니다."],
        [
          "3. 지난주부터 이어지는 업무는 업무명과 담당자를 지난주와 똑같이 적어야 같은 업무로 이어집니다.",
        ],
        ["4. 기한은 2026-11-05 또는 2026.11.5 형식으로 적으세요."],
        [
          `5. 상태는 ${STATUSES.join(" / ")} 중 하나로 적으세요. 비워 두면 추진현황·이슈 문구로 추정합니다.`,
        ],
        ["6. 담당자는 회원 명단의 이름과 똑같이 적어야 제출 현황에 반영됩니다."],
        [],
        ["[입력 예시 — 이 시트의 예시는 업로드되지 않습니다]"],
        header,
        [
          "자산",
          "하반기 고정자산 실사",
          members[0] ?? "홍길동",
          "2026-11-12",
          "진행 중",
          "1차 바코드 실사 완료, 2차 준비 중",
          "",
        ],
        [
          "복리후생/총무",
          "동계 콘도 추첨 시스템 오픈",
          members[1] ?? "김철수",
          "2026-11-04",
          "지연 / 이슈",
          "인증 오류 조치 중",
          "외부 연동 지연",
        ],
        [],
        ["[상태 선택값]", ...STATUSES],
        ["[분야 예시]", ...fields],
        ["[담당자(회원) 명단]", ...members],
      ]);
      guide["!cols"] = [{ wch: 22 }, ...Array.from({ length: 8 }, () => ({ wch: 18 }))];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "업무일지");
      XLSX.utils.book_append_sheet(wb, guide, "작성 안내");
      XLSX.writeFile(wb, `주간업무_업무일지_양식_${weekStartOf()}.xlsx`);
      notify("업무일지 양식을 내려받았습니다. 팀원에게 배포해 같은 양식으로 작성하게 하세요.");
    } catch {
      notify("양식 파일을 만들지 못했습니다.");
    }
  };

  const today = todayIso();
  // 편집 중인 파일은 저장 전 내용으로 분석에 반영
  const rowsOf = (f: UploadFile) =>
    f.id === editingId && editorDirty ? sheetRowsToDrafts(editorRows) : f.rows;
  const includedFiles = useMemo(
    () => (files ?? []).filter((f) => f.kind === "current" && included.has(f.id)),
    [files, included],
  );
  const curDrafts = useMemo(
    () => includedFiles.flatMap(rowsOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [includedFiles, editingId, editorDirty, editorRows],
  );
  const prevDrafts = useMemo(
    () =>
      (files ?? []).filter((f) => f.kind === "prev" && f.week_start === thisWeek).flatMap(rowsOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, thisWeek, editingId, editorDirty, editorRows],
  );
  const memberNames = useMemo(() => users.filter((u) => u.is_active).map((u) => u.name), [users]);

  // 이번 주(월요일 0시) 이후 시스템에서 고친 업무는 파일 값으로 덮어쓰지 않음
  const protectSince = useMemo(() => new Date(`${weekStartOf()}T00:00:00`).toISOString(), []);
  const analysis = useMemo(
    () =>
      analyzeDrafts(curDrafts, {
        existing: tasks,
        memberNames,
        today,
        markOverdue,
        protectSince,
        overwriteConflicts,
      }),
    [curDrafts, tasks, memberNames, today, markOverdue, protectSince, overwriteConflicts],
  );
  const conflictRows = analysis.filter((r) => r.conflicts.length > 0);
  const previewTasks = useMemo(
    () => analysisToTasks<TaskLike>(analysis, () => ({ id: "", code: "" })),
    [analysis],
  );

  const baseline = useMemo(() => {
    if (prevDrafts.length) {
      const rows = analyzeDrafts(prevDrafts, {
        existing: [],
        memberNames: [],
        today,
        markOverdue: false,
      });
      return {
        label: "올린 지난주 보고서",
        tasks: analysisToTasks<TaskLike>(rows, () => ({ id: "", code: "" })),
      };
    }
    if (lastConfirmed) return { label: "지난주 확정 보고서", tasks: lastConfirmed };
    return null;
  }, [prevDrafts, lastConfirmed, today]);

  const comparison = useMemo(
    () => (baseline && previewTasks.length ? compareWeeks(baseline.tasks, previewTasks) : null),
    [baseline, previewTasks],
  );

  const counts = {
    total: analysis.length,
    update: analysis.filter((r) => r.matched).length,
    inferred: analysis.filter((r) => r.statusSource === "추정").length,
    defaulted: analysis.filter((r) => r.statusSource === "기본값").length,
    overdue: analysis.filter((r) => r.overdue).length,
    unknownOwner: analysis.filter((r) => r.unknownOwner).length,
    keptBlank: analysis.reduce((n, r) => n + r.keptBlank, 0),
    conflicts: analysis.reduce((n, r) => n + r.conflicts.length, 0),
  };

  const apply = async () => {
    if (!analysis.length) return;
    setApplying(true);
    try {
      if (editorDirty) await saveEditor();
      const ok = await onApply(
        analysisToTasks<Task>(analysis, () => ({ id: uid(), code: nextCode() })),
      );
      if (!ok) return;
      const ids = includedFiles.map((f) => f.id);
      const now = new Date().toISOString();
      const marked = await runDb(
        supabase.from("upload_files").update({ applied_at: now }).in("id", ids),
        notify,
        "파일 반영 표시 실패",
      );
      if (marked) {
        setFiles((prev) =>
          (prev ?? []).map((f) =>
            ids.includes(f.id) ? { ...f, applied_at: now, updated_at: now } : f,
          ),
        );
        setIncluded(new Set());
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">1. 자료 올리기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            엑셀로 업무를 한꺼번에 등록·갱신합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void downloadTemplate()} className={btnPrimary}>
            <Download className="h-4 w-4" />
            <span>업무일지 양식 내려받기</span>
          </button>
          <button onClick={() => onNavigate("kanban")} className={btnOutline}>
            <span>칸반 보드로 이동 ({tasks.length}건)</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 사용 순서 — 짧게 */}
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["양식 받아 작성", "업무명·담당자는 지난주와 똑같이"],
          ["파일 올리기", "아직 저장 안 됨 — 아래에서 분석 확인"],
          ["반영하기", "칸반·보고서에 바로 반영"],
        ].map(([title, desc], i) => (
          <li
            key={title}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span>
              <b className="block">{title}</b>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 md:grid-cols-2">
        <DropZone
          title="이번 주 업무일지 (팀원별 파일 여러 개 가능)"
          hint="머리글(업무명·담당자·기한…)로 열을 찾습니다. 「지난주」 이름의 시트는 지난주 자료로 읽습니다"
          onFiles={(f) => run(f, false)}
        />
        <DropZone
          title="지난주 보고서"
          hint="지난주 대비 변화를 비교하는 기준으로만 쓰고, 업무로 추가하지 않습니다"
          onFiles={(f) => run(f, true)}
        />
      </div>

      {/* 올린 파일 목록 */}
      <ZenithCard className="p-6">
        <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              올린 파일 ({files?.length ?? 0}개 · 최근 4주)
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              체크한 이번 주 파일이 아래 분석·반영 대상입니다. 파일을 눌러 내용을 보고 고칠 수
              있습니다.
            </p>
          </div>
          <button onClick={() => void createBlankSheet()} className={btnOutline}>
            <Plus className="h-4 w-4" />
            <span>빈 시트 만들기 (직접 입력)</span>
          </button>
        </div>

        {files === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중...</p>
        ) : files.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            아직 올린 파일이 없습니다. 위에 파일을 끌어다 놓거나 빈 시트를 만드세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="w-10 pb-2 text-start font-medium">반영</th>
                  <th className="pb-2 text-start font-medium">파일</th>
                  <th className="pb-2 text-start font-medium">구분</th>
                  <th className="pb-2 text-start font-medium">업무</th>
                  <th className="pb-2 text-start font-medium">올린 사람</th>
                  <th className="pb-2 text-start font-medium">상태</th>
                  <th className="pb-2 text-end font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const selectable = f.kind === "current" && f.week_start === thisWeek;
                  const editedAfterApply =
                    !!f.applied_at && new Date(f.updated_at) > new Date(f.applied_at);
                  return (
                    <tr
                      key={f.id}
                      className={cn(
                        "border-b border-border/50 last:border-0",
                        editingId === f.id && "bg-primary/5",
                      )}
                    >
                      <td className="py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`${f.file_name} 반영 대상`}
                          disabled={!selectable}
                          checked={included.has(f.id)}
                          onChange={(e) =>
                            setIncluded((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(f.id);
                              else next.delete(f.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 accent-primary disabled:opacity-30"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <button
                          onClick={() => openEditor(f)}
                          className="text-start font-medium hover:text-primary hover:underline cursor-pointer"
                        >
                          <FileSpreadsheet className="me-1 inline h-3.5 w-3.5 text-emerald-600" />
                          {f.file_name}
                        </button>
                        <span className="block text-[11px] text-muted-foreground">
                          {weekOrdinalLabel(f.week_start)} · {formatDateTime(f.created_at)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">
                        {f.kind === "current" ? "이번 주 업무일지" : "지난주 보고서(비교용)"}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{f.rows.length}건</td>
                      <td className="py-2.5 pr-3 text-xs">{f.uploaded_by_name || "-"}</td>
                      <td className="py-2.5 pr-3">
                        {f.kind === "prev" ? (
                          <span className="text-xs text-muted-foreground">비교 기준</span>
                        ) : f.applied_at ? (
                          <span
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                              editedAfterApply
                                ? "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning"
                                : "border-success/30 bg-success/10 text-success",
                            )}
                          >
                            {editedAfterApply
                              ? "반영 후 수정됨"
                              : `반영됨 ${formatDateTime(f.applied_at)}`}
                          </span>
                        ) : (
                          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            미반영
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-end whitespace-nowrap">
                        {confirmDeleteId === f.id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="text-destructive">
                              {f.applied_at ? "목록에서 삭제 (반영된 업무는 유지)?" : "삭제할까요?"}
                            </span>
                            <button
                              onClick={() => void deleteFile(f)}
                              className="rounded-md bg-destructive px-2 py-0.5 font-semibold text-white cursor-pointer"
                            >
                              삭제
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent cursor-pointer"
                            >
                              취소
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5">
                            <button
                              onClick={() => openEditor(f)}
                              aria-label={`${f.file_name} 보기·수정`}
                              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {canModify(f) && (
                              <button
                                onClick={() => setConfirmDeleteId(f.id)}
                                aria-label={`${f.file_name} 삭제`}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ZenithCard>

      {/* 선택한 파일 보기·수정 */}
      {editingId &&
        (() => {
          const f = (files ?? []).find((x) => x.id === editingId);
          if (!f) return null;
          const editable = canModify(f);
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {f.file_name}
                  {!editable && (
                    <span className="ms-2 text-xs font-normal text-muted-foreground">
                      (읽기 전용 — 올린 사람 또는 관리자만 수정할 수 있습니다)
                    </span>
                  )}
                  {editorDirty && (
                    <span className="ms-2 text-xs font-normal text-warning-foreground dark:text-warning">
                      저장하지 않은 수정 있음
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditorDirty(false);
                    }}
                    className={btnOutline}
                  >
                    {editorDirty ? "수정 취소" : "닫기"}
                  </button>
                  {editable && (
                    <button
                      onClick={() => void saveEditor()}
                      disabled={!editorDirty}
                      className={cn(btnPrimary, !editorDirty && "opacity-50")}
                    >
                      <Check className="h-4 w-4" />
                      <span>파일 내용 저장</span>
                    </button>
                  )}
                </div>
              </div>
              <JexcelSheet
                title={`${f.file_name} — 내용 보기·수정`}
                subtitle="열 순서: A분야 · B업무명 · C담당자 · D기한 · E상태 · F추진현황 · G이슈 · 행 끝의 휴지통으로 행 삭제"
                rows={editorRows}
                setRows={(next) => {
                  if (!editable) return;
                  setEditorRows(next);
                  setEditorDirty(true);
                }}
              />
            </div>
          );
        })()}

      <ZenithCard className="space-y-5 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">자동 분석 결과 (규칙 기반)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              상태가 비어 있으면 추진현황·이슈 문구로 추정하고, 같은 업무명·담당자의 기존 업무는
              새로 만들지 않고 갱신합니다. 파일의 빈 칸은 기존 값을 지우지 않습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={markOverdue}
                onChange={(e) => setMarkOverdue(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              마감 지난 미완료 업무를 &lsquo;지연 / 이슈&rsquo;로 반영
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={overwriteConflicts}
                onChange={(e) => setOverwriteConflicts(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              이번 주에 시스템에서 고친 칸도 파일 값으로 덮어쓰기
            </label>
            <button
              onClick={() => void apply()}
              disabled={applying || analysis.length === 0}
              className={cn(btnPrimary, (applying || analysis.length === 0) && "opacity-50")}
            >
              <Check className="h-4 w-4" />
              <span>반영하기 ({analysis.length}건)</span>
            </button>
          </div>
        </div>

        {analysis.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            이번 주 업무일지 엑셀표에 업무를 입력하거나 파일을 올리면 분석 결과가 표시됩니다.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                [`총 ${counts.total}건`, "border-foreground bg-foreground text-background"],
                [
                  `신규 ${counts.total - counts.update}건`,
                  "border-success/30 bg-success/10 text-success",
                ],
                [
                  `기존 업무 갱신 ${counts.update}건`,
                  "border-primary/25 bg-primary/10 text-primary",
                ],
                [`상태 추정 ${counts.inferred}건`, "border-primary/25 bg-primary/5 text-primary"],
                [`상태 없음→대기 ${counts.defaulted}건`, STATUS_SOURCE_STYLE["기본값"]],
                [`마감 초과 ${counts.overdue}건`, STATUS_SOURCE_STYLE["마감 초과"]],
                [`미등록 담당자 ${counts.unknownOwner}건`, STATUS_SOURCE_STYLE["기본값"]],
                [`빈 칸 → 기존 값 유지 ${counts.keptBlank}칸`, STATUS_SOURCE_STYLE["기존 유지"]],
                [
                  `충돌(시스템 값 유지) ${counts.conflicts}칸`,
                  "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning",
                ],
              ].map(([label, cls]) => (
                <span
                  key={label}
                  className={cn("rounded-full border px-3 py-1 font-semibold", cls)}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    {["처리", "업무명", "담당자", "기한", "반영 상태", "분석 근거"].map((h) => (
                      <th key={h} className="px-3 py-2 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            r.matched
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-success/30 bg-success/10 text-success",
                          )}
                        >
                          {r.matched ? `갱신 ${r.matched.code ?? ""}` : "신규"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{r.draft.title}</td>
                      <td className="px-3 py-2">
                        {r.final.owner || "미지정"}
                        {r.unknownOwner && (
                          <span className="ml-1 text-[11px] font-semibold text-warning-foreground dark:text-warning">
                            (회원 명단에 없음)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.final.due || "-"}
                        {r.overdue && (
                          <span className="ml-1 text-[11px] font-semibold text-destructive">
                            마감 초과
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            statusBadgeStyle[r.status],
                          )}
                        >
                          {r.status}
                        </span>
                        {r.matched && r.matched.status !== r.status && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            (기존 {r.matched.status})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            STATUS_SOURCE_STYLE[r.statusSource],
                          )}
                        >
                          {r.statusSource === "입력" && "입력값"}
                          {r.statusSource === "추정" && "문구로 추정"}
                          {r.statusSource === "기본값" && "상태 없음 → 대기"}
                          {r.statusSource === "마감 초과" && "기한 지남 → 지연"}
                          {r.statusSource === "기존 유지" && "기존 상태 유지"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {conflictRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-warning/30">
                <p className="border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold">
                  충돌 — 이번 주에 시스템(칸반 등)에서 이미 고친 칸이라 시스템 값을 지켰습니다. 파일
                  값으로 바꾸려면 위의 &lsquo;덮어쓰기&rsquo;를 켜세요.
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-2 text-start">업무</th>
                      <th className="px-3 py-2 text-start">항목</th>
                      <th className="px-3 py-2 text-start">지킨 값 (시스템)</th>
                      <th className="px-3 py-2 text-start">버린 값 (파일)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflictRows.flatMap((r) =>
                      r.conflicts.map((c) => (
                        <tr
                          key={`${r.draft.title}-${c.field}`}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-3 py-2 font-medium">{r.draft.title}</td>
                          <td className="px-3 py-2">{UPLOAD_FIELD_LABELS[c.field]}</td>
                          <td className="px-3 py-2">{c.kept || "(빈 값)"}</td>
                          <td className="px-3 py-2 text-muted-foreground line-through">
                            {c.incoming}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <WeekComparisonPanel comparison={comparison} baselineLabel={baseline?.label ?? null} />
          </>
        )}
      </ZenithCard>
    </div>
  );
}
function WeekComparisonPanel({
  comparison,
  baselineLabel,
}: {
  comparison: WeekComparison | null;
  baselineLabel: string | null;
}) {
  if (!comparison || !baselineLabel) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        지난주 대비 변화: 비교 기준이 없습니다. 지난주 보고서를 올리거나, 지난주 보고서를 최종
        확정해 두면 자동으로 비교합니다.
      </p>
    );
  }
  const groups: { label: string; cls: string; items: string[] }[] = [
    {
      label: "완료됨",
      cls: "border-success/30 bg-success/5",
      items: comparison.completed.map((t) => `${t.title} (${t.owner})`),
    },
    {
      label: "상태 변화",
      cls: "border-primary/25 bg-primary/5",
      items: comparison.statusChanged.map((c) => `${c.task.title}: ${c.from} → ${c.to}`),
    },
    {
      label: "진척 없음 (추진현황이 지난주와 같음)",
      cls: "border-warning/30 bg-warning/5",
      items: comparison.stalled.map((t) => `${t.title} (${t.owner})`),
    },
    {
      label: "이월 (계속 진행)",
      cls: "border-border bg-muted/30",
      items: comparison.carried.map((t) => `${t.title} (${t.owner})`),
    },
    {
      label: "신규",
      cls: "border-success/30 bg-success/5",
      items: comparison.added.map((t) => `${t.title} (${t.owner})`),
    },
    {
      label: "사라짐 (지난주 미완료, 이번 주 목록에 없음)",
      cls: "border-destructive/30 bg-destructive/5",
      items: comparison.dropped.map((t) => `${t.title} (${t.owner})`),
    },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">
        지난주 대비 변화{" "}
        <span className="text-xs font-normal text-muted-foreground">(기준: {baselineLabel})</span>
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.label} className={cn("rounded-lg border p-3", g.cls)}>
            <p className="text-xs font-semibold">
              {g.label} · {g.items.length}건
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              {g.items.length ? g.items.map((it) => <li key={it}>• {it}</li>) : <li>없음</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
/* ============================================================================
 * 3. KANBAN BOARD VIEW
 * ============================================================================ */
type BoardCard = Task & {
  badge?: { label: string; cls: string } | undefined;
  trail?: (string | null)[] | undefined;
};

const TRAIL_DOT: Record<string, string> = {
  대기: "bg-warning",
  "진행 중": "bg-primary",
  "지연 / 이슈": "bg-destructive",
  완료: "bg-success",
};

function TaskCard({
  card,
  editable,
  trailWeeks,
  onDelete,
  onOpen,
}: {
  card: BoardCard;
  editable: boolean;
  trailWeeks?: string[] | undefined;
  onDelete?: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      draggable={editable}
      onDragStart={editable ? (e) => e.dataTransfer.setData("text/plain", card.id) : undefined}
      onClick={editable ? onOpen : undefined}
      onKeyDown={
        editable && onOpen
          ? (e) => {
              if (e.key === "Enter") onOpen();
            }
          : undefined
      }
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `${card.title} 편집` : undefined}
      className={cn(
        "group rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-all duration-200 hover:border-primary/30 hover:shadow-md",
        editable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            fieldColor[card.field] ?? "bg-primary/10 text-primary",
          )}
        >
          {card.field || "미분류"}
        </span>
        {card.badge && (
          <span
            className={cn(
              "ml-auto rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
              card.badge.cls,
            )}
          >
            {card.badge.label}
          </span>
        )}
        {editable && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="업무 삭제"
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2.5 text-sm font-bold leading-snug">{card.title}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        👤 {card.owner} · 📅 {card.due || "기한 미정"}
        {isOverdue(card) && (
          <span className="ml-1 font-semibold text-destructive">· 마감 초과</span>
        )}
      </p>
      {card.progress && (
        <p className="mt-2 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground/90">
          {card.progress}
        </p>
      )}
      {card.issue && (
        <span className="mt-2 inline-block rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
          ⚠ {card.issue}
        </span>
      )}
      {card.trail && trailWeeks && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-border/60 pt-2">
          {card.trail.map((st, i) => (
            <span
              key={trailWeeks[i]}
              title={`${weekOrdinalLabel(trailWeeks[i]!)}: ${st ?? "없음"}`}
              className="flex flex-1 flex-col items-center gap-0.5"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full",
                  st ? (TRAIL_DOT[st] ?? "bg-muted") : "bg-muted",
                )}
              />
              <span className="text-[9px] text-muted-foreground">
                {weekOrdinalLabel(trailWeeks[i]!).split(" ")[1]}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const historyToTask = (s: WeeklyState): Task => ({
  id: s.task_id,
  code: s.code,
  field: s.field,
  title: s.title,
  owner: s.owner,
  due: s.due,
  status: ((STATUSES as readonly string[]).includes(s.status) ? s.status : "대기") as Status,
  progress: s.progress,
  issue: s.issue,
});

// 칸반 카드 편집 창 (Jira 이슈 화면 형태) — 왼쪽 본문(업무명·추진현황·이슈·주차별 기록), 오른쪽 세부 정보
function TaskEditModal({
  task,
  fields,
  memberNames,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  fields: string[];
  memberNames: string[];
  onClose: () => void;
  onSave: (t: Task) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [f, setF] = useState<Task>(task);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState<WeeklyState[] | null>(null);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const keys = ["field", "title", "owner", "due", "status", "progress", "issue"] as const;
  const dirty = keys.some((k) => (f[k] ?? "").trim() !== (task[k] ?? "").trim());
  const unknownOwner =
    f.owner.trim() !== "" && memberNames.length > 0 && !memberNames.includes(f.owner.trim());

  // 이 업무의 주차별 기록 (Jira 활동 내역처럼 최신 주부터)
  useEffect(() => {
    let alive = true;
    supabase
      .from("task_weekly_states")
      .select("*")
      .eq("task_id", task.id)
      .order("week_start", { ascending: false })
      .then(({ data, error }) => {
        if (alive) setHistory(error || !Array.isArray(data) ? [] : (data as WeeklyState[]));
      });
    return () => {
      alive = false;
    };
  }, [task.id]);

  const save = async () => {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...f,
        field: f.field.trim(),
        title: f.title.trim(),
        owner: f.owner.trim() || "미지정",
        progress: f.progress.trim(),
        issue: f.issue.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sectionLabel = "mb-1.5 block text-xs font-semibold text-muted-foreground";
  const detailRow = "grid grid-cols-[72px_1fr] items-center gap-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="업무 편집"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && dirty) void save();
        }}
        className="w-full max-w-5xl"
      >
        <ZenithCard className="overflow-hidden p-0 shadow-xl">
          {/* 상단 바: 분야 / 업무코드 · 닫기 */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{task.field || "미분류"}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-foreground">{task.code}</span>
            </p>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid max-h-[78vh] overflow-y-auto md:grid-cols-[1fr_300px] md:overflow-hidden">
            {/* 왼쪽 본문 */}
            <div className="space-y-5 p-6 md:max-h-[78vh] md:overflow-y-auto">
              <input
                aria-label="업무명"
                className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-xl font-bold outline-none transition-colors hover:border-input focus:border-primary focus:bg-background"
                value={f.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="업무명"
              />

              <div>
                <label className={sectionLabel} htmlFor="edit-progress">
                  추진현황 <span className="font-normal">· 보고서 금주 실적에 들어갑니다</span>
                </label>
                <textarea
                  id="edit-progress"
                  rows={5}
                  className={cn(inputCls, "h-auto py-2 leading-relaxed")}
                  value={f.progress}
                  onChange={(e) => set("progress", e.target.value)}
                  placeholder="이번 주 진행한 내용을 적어주세요"
                />
              </div>

              <div>
                <label className={sectionLabel} htmlFor="edit-issue">
                  이슈 <span className="font-normal">· 없으면 비워두세요</span>
                </label>
                <textarea
                  id="edit-issue"
                  rows={2}
                  className={cn(inputCls, "h-auto py-2 leading-relaxed")}
                  value={f.issue}
                  onChange={(e) => set("issue", e.target.value)}
                />
              </div>

              <div>
                <p className={sectionLabel}>주차별 기록</p>
                {history === null ? (
                  <p className="text-xs text-muted-foreground">불러오는 중...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">아직 기록이 없습니다.</p>
                ) : (
                  <ol className="relative space-y-3 border-s border-border ps-4">
                    {history.map((h, i) => {
                      const older = history[i + 1];
                      return (
                        <li key={h.week_start} className="relative">
                          <span
                            className={cn(
                              "absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                              TRAIL_DOT[h.status] ?? "bg-muted",
                            )}
                          />
                          <p className="text-xs font-semibold">
                            {weekOrdinalLabel(h.week_start)}
                            <span className="ms-1.5 font-normal text-muted-foreground">
                              {weekLabel(h.week_start)}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs">
                            {h.deleted ? (
                              <span className="text-destructive">삭제됨</span>
                            ) : older && older.status !== h.status ? (
                              <>
                                상태 <b>{older.status}</b> → <b>{h.status}</b>
                              </>
                            ) : (
                              <>
                                상태 <b>{h.status}</b>
                              </>
                            )}
                          </p>
                          {h.progress && (
                            <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground/90">
                              {h.progress}
                            </p>
                          )}
                          {h.issue && (
                            <p className="mt-1 text-[11px] text-destructive">⚠ {h.issue}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>

            {/* 오른쪽 세부 정보 */}
            <aside className="space-y-4 border-t border-border bg-muted/30 p-5 md:max-h-[78vh] md:overflow-y-auto md:border-s md:border-t-0">
              <select
                aria-label="상태"
                className={cn(
                  "h-9 w-full cursor-pointer rounded-lg border px-3 text-sm font-semibold outline-none",
                  statusBadgeStyle[f.status],
                )}
                value={f.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                {STATUSES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>

              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-semibold">세부 정보</p>
                <div className={detailRow}>
                  <label className="text-xs text-muted-foreground" htmlFor="edit-owner">
                    담당자
                  </label>
                  <div>
                    <input
                      id="edit-owner"
                      list="edit-owner-list"
                      className={cn(inputCls, "h-8 text-xs")}
                      value={f.owner}
                      onChange={(e) => set("owner", e.target.value)}
                    />
                    <datalist id="edit-owner-list">
                      {memberNames.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                </div>
                {unknownOwner && (
                  <p className="text-[11px] text-warning-foreground dark:text-warning">
                    회원 명단에 없는 담당자입니다 (제출 현황 미반영).
                  </p>
                )}
                <div className={detailRow}>
                  <label className="text-xs text-muted-foreground" htmlFor="edit-due">
                    기한
                  </label>
                  <input
                    id="edit-due"
                    type="date"
                    className={cn(inputCls, "h-8 text-xs")}
                    value={/^\d{4}-\d{2}-\d{2}$/.test(f.due) ? f.due : ""}
                    onChange={(e) => set("due", e.target.value)}
                  />
                </div>
                {isOverdue(f) && (
                  <p className="text-[11px] font-medium text-destructive">
                    기한이 지났습니다. 상태나 기한을 확인해주세요.
                  </p>
                )}
                <div className={detailRow}>
                  <label className="text-xs text-muted-foreground" htmlFor="edit-field">
                    분야
                  </label>
                  <div>
                    <input
                      id="edit-field"
                      list="edit-field-list"
                      className={cn(inputCls, "h-8 text-xs")}
                      value={f.field}
                      onChange={(e) => set("field", e.target.value)}
                    />
                    <datalist id="edit-field-list">
                      {fields.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>업무 코드 · {task.code}</p>
                {task.updated_at && <p>최근 수정 · {formatDateTime(task.updated_at)}</p>}
                <p>Ctrl+Enter 저장 · Esc 닫기</p>
              </div>
            </aside>
          </div>

          {/* 하단 동작 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-destructive">이 업무를 삭제할까요?</span>
                <button
                  onClick={() => void onDelete()}
                  className="rounded-md bg-destructive px-2.5 py-1 font-semibold text-white cursor-pointer"
                >
                  삭제
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                업무 삭제
              </button>
            )}
            <div className="flex items-center gap-2">
              <button className={btnOutline} onClick={onClose}>
                취소
              </button>
              <button
                className={cn(btnPrimary, (!dirty || saving || !f.title.trim()) && "opacity-50")}
                disabled={!dirty || saving || !f.title.trim()}
                onClick={() => void save()}
              >
                <Check className="h-4 w-4" />
                <span>{saving ? "저장 중..." : "저장"}</span>
              </button>
            </div>
          </div>
        </ZenithCard>
      </div>
    </div>
  );
}

function KanbanView({
  tasks,
  setTasks,
  users,
  notify,
  onOpenNewTask,
  onSyncTask,
  onSaveTask,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  users: AppUser[];
  notify: (m: string) => void;
  onOpenNewTask: () => void;
  onSyncTask: (t: Task) => Promise<void>;
  onSaveTask: (t: Task) => Promise<boolean>;
}) {
  const thisWeek = weekStartOf();
  const [editing, setEditing] = useState<Task | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [selectedField, setSelectedField] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(thisWeek);
  const [month, setMonth] = useState(() => monthOf());
  const [history, setHistory] = useState<WeeklyState[] | null>(null);

  const isLive = mode === "week" && week === thisWeek;

  // 주차별 상태 기록 (보드 재구성 · 주차별 변경 건수). 편집 후 다른 주를 보면 다시 불러옴
  useEffect(() => {
    let alive = true;
    supabase
      .from("task_weekly_states")
      .select("*")
      .lte("week_start", thisWeek)
      .then(({ data, error }) => {
        if (alive) setHistory(error || !Array.isArray(data) ? [] : (data as WeeklyState[]));
      });
    return () => {
      alive = false;
    };
  }, [mode, week, month, thisWeek]);

  const onDrop = async (e: DragEvent, s: Status) => {
    setOver(null);
    if (!isLive) return;
    const id = e.dataTransfer.getData("text/plain");
    let changed: Task | undefined;
    setTasks((p) =>
      p.map((t) => {
        if (t.id === id) {
          changed = { ...t, status: s };
          return changed;
        }
        return t;
      }),
    );
    notify(`상태가 '${s}'(으)로 변경되었습니다.`);
    if (changed) await onSyncTask(changed);
  };

  const deleteTask = async (t: Task) => {
    setTasks((prev) => prev.filter((item) => item.id !== t.id));
    notify("업무가 삭제되었습니다.");
    try {
      await supabase.from("tasks").delete().eq("id", t.id);
    } catch {
      // ignore
    }
  };

  const monthWeeks = useMemo(() => weeksOfMonth(month), [month]);
  const stripWeeks = useMemo(() => weeksOfMonth(monthOf(new Date(`${week}T00:00:00`))), [week]);
  const rows = history ?? [];

  const { cards, summary } = useMemo((): {
    cards: BoardCard[];
    summary: { label: string; cls: string }[];
  } => {
    if (isLive) {
      const changed = changedInWeek(rows, thisWeek);
      return {
        cards: tasks.map((t) => ({
          ...t,
          badge: changed.has(t.id)
            ? { label: "이번 주 갱신", cls: "border-success/30 bg-success/10 text-success" }
            : undefined,
        })),
        summary: [],
      };
    }
    if (mode === "week") {
      const changed = changedInWeek(rows, week);
      const list = stateAsOf(rows, week).map((s) => ({
        ...historyToTask(s),
        badge: changed.has(s.task_id)
          ? { label: "이 주 갱신", cls: "border-success/30 bg-success/10 text-success" }
          : { label: "변경 없음", cls: "border-border bg-muted text-muted-foreground" },
      }));
      return {
        cards: list,
        summary: [
          {
            label: `업무 ${list.length}건`,
            cls: "border-foreground bg-foreground text-background",
          },
          {
            label: `이 주 갱신 ${changed.size}건`,
            cls: "border-success/30 bg-success/10 text-success",
          },
          {
            label: `변경 없음 ${list.length - list.filter((c) => changed.has(c.id)).length}건`,
            cls: "border-border bg-muted text-muted-foreground",
          },
        ],
      };
    }
    const until = monthWeeks.filter((w) => w <= thisWeek);
    const items = monthTimeline(rows, monthWeeks, until[until.length - 1] ?? monthWeeks[0]);
    return {
      cards: items.map((it) => ({
        ...historyToTask(it.state),
        trail: it.trail,
        badge: it.createdThisMonth
          ? { label: "이달 신규", cls: "border-primary/25 bg-primary/10 text-primary" }
          : undefined,
      })),
      summary: [
        { label: `업무 ${items.length}건`, cls: "border-foreground bg-foreground text-background" },
        {
          label: `이달 신규 ${items.filter((i) => i.createdThisMonth).length}건`,
          cls: "border-primary/25 bg-primary/10 text-primary",
        },
        {
          label: `이달 완료 ${items.filter((i) => i.completedThisMonth).length}건`,
          cls: "border-success/30 bg-success/10 text-success",
        },
        {
          label: `지연 발생 ${items.filter((i) => i.delayedThisMonth).length}건`,
          cls: "border-destructive/30 bg-destructive/10 text-destructive",
        },
      ],
    };
  }, [isLive, mode, week, rows, tasks, monthWeeks, thisWeek]);

  const trailWeeks = useMemo(() => monthWeeks.filter((w) => w <= thisWeek), [monthWeeks, thisWeek]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((t) => {
      const matchesField =
        selectedField === "전체" || (t.field.trim() || "미분류") === selectedField;
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.owner.toLowerCase().includes(q) ||
        t.progress.toLowerCase().includes(q);
      return matchesField && matchesSearch;
    });
  }, [cards, selectedField, searchQuery]);

  const changesIn = (w: string) => changedInWeek(rows, w).size;
  const [mYear, mMonth] = month.split("-");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">2. 진행상태 (칸반 보드)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLive
              ? "이번 주 보드입니다. 카드를 끌어서 상태를 바꾸고, 카드를 눌러 추진현황·이슈를 수정하세요."
              : mode === "week"
                ? `${weekLabel(week)} 주 말 기준 상태입니다 (읽기 전용).`
                : `${mYear}년 ${Number(mMonth)}월 통합 보드 — 카드 아래 막대가 주차별 상태 흐름입니다 (읽기 전용).`}
          </p>
        </div>
        {isLive && (
          <button className={btnPrimary} onClick={onOpenNewTask}>
            + 새 업무 등록
          </button>
        )}
      </div>

      {/* 기간 선택: 주간 / 월간 */}
      <ZenithCard className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-input bg-background p-0.5">
            {(
              [
                ["week", "주간"],
                ["month", "월간"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "week" ? (
            <WeekPicker week={week} onChange={setWeek} />
          ) : (
            <div className="inline-flex items-center gap-1 rounded-lg border border-input bg-background p-0.5">
              <button
                onClick={() => setMonth(addMonths(month, -1))}
                aria-label="이전 달"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <span className="min-w-28 px-1 text-center text-xs font-semibold">
                {mYear}년 {Number(mMonth)}월
              </span>
              <button
                onClick={() => setMonth(addMonths(month, 1))}
                disabled={month >= monthOf()}
                aria-label="다음 달"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {!isLive && (
            <button
              onClick={() => {
                setMode("week");
                setWeek(thisWeek);
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              이번 주로 돌아가기
            </button>
          )}

          {summary.length > 0 && (
            <div className="flex flex-wrap gap-1.5 lg:ml-auto">
              {summary.map((s) => (
                <span
                  key={s.label}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    s.cls,
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 주차 달력 줄 — 선택한 주가 속한 달의 주들, 주마다 갱신 건수 */}
        {mode === "week" && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {stripWeeks.map((w) => {
              const future = w > thisWeek;
              const n = changesIn(w);
              return (
                <button
                  key={w}
                  disabled={future}
                  onClick={() => setWeek(w)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-start transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                    w === week ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  <span className="block text-xs font-semibold">
                    {weekOrdinalLabel(w)}
                    {w === thisWeek && <span className="ml-1 text-primary">· 이번 주</span>}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {weekLabel(w).slice(5)} · {future ? "-" : `갱신 ${n}건`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ZenithCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["전체", ...fieldsOf(cards, FIELDS)].map((fd) => (
            <button
              key={fd}
              onClick={() => setSelectedField(fd)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                selectedField === fd
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {fd}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="업무명 또는 담당자 검색..."
            className="h-9 w-full rounded-lg border border-input bg-card ps-9 pe-3 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {!isLive && history === null ? (
        <ZenithCard className="p-10 text-center text-sm text-muted-foreground">
          기록을 불러오는 중...
        </ZenithCard>
      ) : !isLive && cards.length === 0 ? (
        <ZenithCard className="p-10 text-center text-sm text-muted-foreground">
          이 기간의 기록이 없습니다. 주차별 상태는 기록 기능이 켜진 주부터 쌓입니다.
        </ZenithCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => {
            const list = filteredCards.filter((t) => t.status === s);
            return (
              <div
                key={s}
                onDragOver={
                  isLive
                    ? (e) => {
                        e.preventDefault();
                        setOver(s);
                      }
                    : undefined
                }
                onDragLeave={() => setOver(null)}
                onDrop={(e) => onDrop(e, s)}
                className={cn(
                  "min-h-[440px] rounded-xl border-2 p-3.5 transition-colors",
                  over === s ? "border-primary bg-primary/5" : "border-border/60 bg-muted/40",
                )}
              >
                <div className="mb-3.5 flex items-center justify-between px-1">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      statusBadgeStyle[s],
                    )}
                  >
                    {s}
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-2xs">
                    {list.length}건
                  </span>
                </div>
                <div className="space-y-2.5">
                  {list.map((card) => (
                    <TaskCard
                      key={card.id}
                      card={card}
                      editable={isLive}
                      trailWeeks={mode === "month" ? trailWeeks : undefined}
                      onDelete={() => void deleteTask(card)}
                      onOpen={() => setEditing(tasks.find((t) => t.id === card.id) ?? null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TaskEditModal
          task={editing}
          fields={fieldsOf(tasks, FIELDS)}
          memberNames={users.filter((u) => u.is_active).map((u) => u.name)}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            if (await onSaveTask(next)) setEditing(null);
          }}
          onDelete={async () => {
            await deleteTask(editing);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
/* ============================================================================
 * 4. WEEKLY REPORT VIEW (주간업무보고서)
 * ============================================================================ */
function ReportContent({
  tasks,
  notify,
  title = "주간업무보고서",
  headerExtra,
  prevTasks,
  today = todayIso(),
}: {
  tasks: Task[];
  notify: (m: string) => void;
  title?: string;
  headerExtra?: ReactNode;
  prevTasks?: TaskLike[] | null; // 지난주 확정본 (없으면 비교 생략)
  today?: string;
}) {
  const cnt = (s: Status) => tasks.filter((t) => t.status === s).length;
  // 상태가 지연이거나, 기한이 지났는데 완료되지 않은 업무
  const delayed = tasks.filter((t) => t.status === "지연 / 이슈" || isOverdue(t, today));
  const overdueLabel = (t: Task) => (isOverdue(t, today) ? " [마감 초과]" : "");
  const fields = fieldsOf(tasks, FIELDS);
  const inField = (fd: string) => tasks.filter((t) => (t.field.trim() || "미분류") === fd);
  const comparison = prevTasks ? compareWeeks(prevTasks, tasks) : null;
  const done = (l: Task[]) => l.filter((t) => t.status === "완료" || t.status === "진행 중");
  const next = (l: Task[]) => l.filter((t) => t.status !== "완료");

  const copy = async () => {
    let s = `${title}\n\nⅠ. 전체 요약\n총 ${tasks.length}건 (완료 ${cnt("완료")} / 진행 중 ${cnt("진행 중")} / 대기 ${cnt("대기")} / 지연 ${cnt("지연 / 이슈")})\n\nⅡ. 분야별 실적\n`;
    fields.forEach((fd) => {
      const l = inField(fd);
      s += `\n[${fd}]\n 금주 실적:\n${
        done(l)
          .map((t) => `  - ${t.title} (${t.owner}): ${t.progress}`)
          .join("\n") || "  - 없음"
      }\n 차주 계획:\n${
        next(l)
          .map((t) => `  - ${t.title} (~${t.due})`)
          .join("\n") || "  - 없음"
      }\n`;
    });
    s += `\nⅢ. 주요 이슈 및 지연 업무\n${
      delayed
        .map((t) => `  - ${t.title} (${t.owner})${overdueLabel(t)}: ${t.issue || t.progress}`)
        .join("\n") || "  - 없음"
    }`;
    if (comparison) {
      const line = (label: string, items: string[]) =>
        `\n [${label}] ${items.length ? items.join(", ") : "없음"}`;
      s += `\n\nⅣ. 지난주 대비 변화${line(
        "완료됨",
        comparison.completed.map((t) => t.title),
      )}${line(
        "상태 변화",
        comparison.statusChanged.map((c) => `${c.task.title}(${c.from}→${c.to})`),
      )}${line(
        "진척 없음",
        comparison.stalled.map((t) => t.title),
      )}${line(
        "신규",
        comparison.added.map((t) => t.title),
      )}${line(
        "사라짐",
        comparison.dropped.map((t) => t.title),
      )}`;
    }
    try {
      await navigator.clipboard.writeText(s);
      notify("보고서 텍스트가 클립보드에 복사되었습니다.");
    } catch {
      notify("복사에 실패했습니다.");
    }
  };

  return (
    <ZenithCard className="space-y-8 p-6 sm:p-8">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            등록된 업무 데이터를 기반으로 자동 생성된 부서 주간업무보고서입니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerExtra}
          <button className={btnPrimary} onClick={copy}>
            <Copy className="h-4 w-4" />
            <span>📋 보고서 텍스트 복사</span>
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-base font-bold">Ⅰ. 전체 요약</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-foreground px-3.5 py-1 text-xs font-semibold text-background">
            총 {tasks.length}건
          </span>
          {STATUSES.map((s) => (
            <span
              key={s}
              className={cn(
                "rounded-full border px-3.5 py-1 text-xs font-semibold",
                statusBadgeStyle[s],
              )}
            >
              {s} {cnt(s)}건
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold">Ⅱ. 분야별 실적</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {["분야", "금주 실적", "차주 계획"].map((h) => (
                  <th
                    key={h}
                    className="border-r border-border last:border-r-0 px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((fd) => {
                const l = inField(fd);
                return (
                  <tr
                    key={fd}
                    className="border-b border-border last:border-b-0 align-top transition-colors hover:bg-muted/20"
                  >
                    <td className="w-40 border-r border-border px-4 py-3.5 font-semibold">{fd}</td>
                    <td className="border-r border-border px-4 py-3.5 space-y-1">
                      {done(l).length ? (
                        done(l).map((t) => (
                          <div key={t.id} className="text-sm">
                            • <span className="font-medium">{t.title}</span> ({t.owner}) –{" "}
                            <span className="text-muted-foreground">{t.progress}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      {next(l).length ? (
                        next(l).map((t) => (
                          <div key={t.id} className="text-sm">
                            • <span className="font-medium">{t.title}</span>{" "}
                            <span className="text-xs text-muted-foreground">(~{t.due})</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">없음</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold">Ⅲ. 주요 이슈 및 지연 업무</h3>
        {delayed.length ? (
          <div className="space-y-2.5">
            {delayed.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-destructive/25 border-l-4 border-l-destructive bg-destructive/10 p-4"
              >
                <p className="font-bold text-destructive">
                  ⚠ {t.title}
                  {isOverdue(t, today) && (
                    <span className="ml-1.5 rounded border border-destructive/30 px-1.5 py-0.5 text-[10px]">
                      마감 초과
                    </span>
                  )}{" "}
                  <span className="text-xs font-normal text-foreground/80">
                    ({t.field} · {t.owner} · {t.due})
                  </span>
                </p>
                <p className="mt-1 text-sm text-foreground/90">
                  이슈: {t.issue || "-"} / 추진현황: {t.progress}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">지연 업무가 없습니다.</p>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold">Ⅳ. 지난주 대비 변화</h3>
        <WeekComparisonPanel
          comparison={comparison}
          baselineLabel={comparison ? "지난주 확정 보고서" : null}
        />
      </section>
    </ZenithCard>
  );
}
/* ============================================================================
 * 5. ADMIN USER MANUAL REGISTRATION VIEW (관리자 직접 수동 등록)
 * ============================================================================ */
type DbResult = { error: { message: string } | null };

// Supabase 쓰기 결과 확인 — 실패하면 알림 후 false
async function runDb(
  query: PromiseLike<DbResult>,
  notify: (m: string) => void,
  failMsg: string,
): Promise<boolean> {
  try {
    const { error } = await query;
    if (error) {
      notify(`${failMsg}: ${error.message}`);
      return false;
    }
    return true;
  } catch {
    notify(`${failMsg}: 네트워크 오류`);
    return false;
  }
}

function positionName(positions: Position[], id?: string | null) {
  return positions.find((p) => p.id === id)?.name ?? "";
}

function departmentName(departments: Department[], u: AppUser) {
  return departments.find((d) => d.id === u.department_id)?.name ?? u.department;
}

const ROOT_PARENT = "";

function DepartmentOptions({ departments }: { departments: Department[] }) {
  return (
    <>
      {flattenDepartments(departments).map(({ dept, depth }) => (
        <option key={dept.id} value={dept.id}>
          {`${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${dept.name}`}
        </option>
      ))}
    </>
  );
}

// 클릭하면 입력창으로 바뀌는 이름 편집기
function InlineNameEdit({
  value,
  label,
  onSave,
}: {
  value: string;
  label: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`${label} 이름 수정`}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    );
  }

  const save = async () => {
    const next = draft.trim();
    if (next && next !== value) await onSave(next);
    setEditing(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className={cn(inputCls, "h-8 w-40")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => void save()}
        aria-label={`${label} 이름 저장`}
        className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10 cursor-pointer"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setEditing(false)}
        aria-label="취소"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/* ============================================================================
 * 5-1. 계정관리 · 회원 관리
 * ============================================================================ */
function AdminUserManagementView({
  users,
  setUsers,
  departments,
  positions,
  currentUser,
  notify,
  onActivity,
}: {
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  departments: Department[];
  positions: Position[];
  currentUser: AppUser;
  notify: (m: string) => void;
  onActivity: (title: string, description: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [role, setRole] = useState<UserRole>("팀원");
  const [submitting, setSubmitting] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");

  const sortedPositions = [...positions].sort((a, b) => a.rank - b.rank);
  const rankOf = (u: AppUser) =>
    positions.find((p) => p.id === u.position_id)?.rank ?? Number.MAX_SAFE_INTEGER;

  const filterIds = deptFilter ? descendantIds(departments, deptFilter) : null;
  const visibleUsers = users
    .filter((u) => !filterIds || (u.department_id && filterIds.has(u.department_id)))
    .sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));

  const handleManualRegister = async (e: FormEvent) => {
    e.preventDefault();
    const cleanId = username.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanEmail = usernameToAuthEmail(cleanId);
    const cleanPw = password.trim();
    const deptName = departments.find((d) => d.id === departmentId)?.name ?? "";

    if (!cleanId || !cleanName) {
      return notify("아이디와 성명을 입력해주세요.");
    }
    if (!USERNAME_PATTERN.test(cleanId)) {
      return notify("아이디는 영문 소문자·숫자·._- 조합 3~30자로 입력해주세요.");
    }
    if (cleanPw.length < 8) {
      return notify("초기 비밀번호는 8자 이상이어야 합니다.");
    }
    if (
      users.some(
        (u) =>
          u.username.toLowerCase() === cleanId.toLowerCase() ||
          u.email.toLowerCase() === cleanEmail.toLowerCase(),
      )
    ) {
      return notify("이미 등록된 아이디입니다.");
    }

    setSubmitting(true);
    try {
      // 1. Supabase Auth 계정 생성 (비밀번호는 Auth 에만 저장)
      const { data: signUpData, error: signUpErr } = await supabaseAdminRegistrar.auth.signUp({
        email: cleanEmail,
        password: cleanPw,
        options: {
          data: { username: cleanId, name: cleanName, department: deptName, role },
        },
      });
      if (signUpErr || !signUpData.user) {
        return notify(`계정 생성 실패: ${signUpErr?.message ?? "알 수 없는 오류"}`);
      }

      // 2. app_users 프로필/소속/직급/권한 등록 (RLS: 관리자만 가능)
      const { data: inserted, error: insertErr } = await supabase
        .from("app_users")
        .insert({
          auth_user_id: signUpData.user.id,
          username: cleanId,
          email: cleanEmail,
          name: cleanName,
          department: deptName,
          department_id: departmentId || null,
          position_id: positionId || null,
          role,
          is_active: true,
          created_by: currentUser.username,
        })
        .select()
        .single();
      if (insertErr || !inserted) {
        return notify(`회원 등록 실패: ${insertErr?.message ?? "알 수 없는 오류"}`);
      }

      setUsers((prev) => [...prev, mapAppUserRow(inserted)]);
      const posName = positionName(positions, positionId);
      onActivity(
        "신규 회원 등록 완료",
        `${cleanName} (${cleanId} · ${deptName || "소속 없음"}${posName ? ` · ${posName}` : ""} · ${role}) 계정이 발급되었습니다.`,
      );
      setUsername("");
      setPassword("");
      setName("");
      notify(`'${cleanName}' (${cleanId}) 회원이 등록되었습니다.`);
    } finally {
      setSubmitting(false);
    }
  };

  // 회원 소속/직급/권한/상태 변경 — DB 반영 성공 시에만 화면 갱신
  const updateMember = async (u: AppUser, patch: Partial<AppUser>, label: string) => {
    const ok = await runDb(
      supabase.from("app_users").update(patch).eq("id", u.id),
      notify,
      `${u.name} ${label} 변경 실패`,
    );
    if (!ok) return;
    setUsers((prev) => prev.map((item) => (item.id === u.id ? { ...item, ...patch } : item)));
    notify(`${u.name} 님의 ${label}이(가) 변경되었습니다.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">회원 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          관리자가 회원을 직접 등록하고 소속 조직·직급·권한을 관리합니다. 조직과 직급은{" "}
          <b>조직도 관리</b>, <b>직급 관리</b> 메뉴에서 설정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* 회원 등록 폼 */}
        <ZenithCard className="col-span-full xl:col-span-4 p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">신규 회원 등록</h2>
              <p className="text-xs text-muted-foreground">
                로그인 계정과 회원 정보를 함께 발급합니다
              </p>
            </div>
          </div>

          <form onSubmit={handleManualRegister} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">
                로그인 아이디 <span className="text-destructive">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="예: honggd"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  성명 <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputCls}
                  placeholder="예: 홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">초기 비밀번호</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="8자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium">소속 조직</label>
                <select
                  aria-label="소속 조직"
                  className={inputCls}
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <DepartmentOptions departments={departments} />
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">직급</label>
                <select
                  aria-label="직급"
                  className={inputCls}
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  {sortedPositions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">시스템 권한</label>
              <select
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="팀원">팀원</option>
                <option value="관리자">관리자</option>
              </select>
            </div>

            {(departments.length === 0 || positions.length === 0) && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-muted-foreground">
                {departments.length === 0 && "등록된 조직이 없습니다. "}
                {positions.length === 0 && "등록된 직급이 없습니다. "}
                조직도 관리 / 직급 관리에서 먼저 등록하세요.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(btnPrimary, "w-full mt-2", submitting && "opacity-70")}
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? "회원 등록 중..." : "+ 회원 등록"}</span>
            </button>
          </form>
        </ZenithCard>

        {/* 회원 목록 */}
        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">회원 목록 ({visibleUsers.length}명)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                직급 순으로 정렬되며, 표에서 바로 소속·직급·권한을 변경할 수 있습니다.
              </p>
            </div>
            <select
              aria-label="조직 필터"
              className={cn(inputCls, "sm:w-48")}
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">전체 조직</option>
              <DepartmentOptions departments={departments} />
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["회원", "소속 조직", "직급", "권한", "상태", "관리"].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "pb-3 text-xs font-medium text-muted-foreground",
                        i === 5 ? "text-end" : "text-start",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u, idx) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white",
                            AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                          )}
                        >
                          {u.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        aria-label={`${u.name} 소속 조직`}
                        className={cn(inputCls, "h-8 min-w-36 text-xs")}
                        value={u.department_id ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const deptName = departments.find((d) => d.id === id)?.name ?? "";
                          void updateMember(
                            u,
                            { department_id: id, department: deptName },
                            "소속 조직",
                          );
                        }}
                      >
                        <option value="">
                          {u.department_id ? "소속 없음" : u.department || "소속 없음"}
                        </option>
                        <DepartmentOptions departments={departments} />
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        aria-label={`${u.name} 직급`}
                        className={cn(inputCls, "h-8 min-w-24 text-xs")}
                        value={u.position_id ?? ""}
                        onChange={(e) =>
                          void updateMember(u, { position_id: e.target.value || null }, "직급")
                        }
                      >
                        <option value="">미지정</option>
                        {sortedPositions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        aria-label={`${u.name} 권한`}
                        className={cn(inputCls, "h-8 w-20 text-xs")}
                        value={u.role}
                        disabled={u.username === "admin"}
                        onChange={(e) =>
                          void updateMember(u, { role: e.target.value as UserRole }, "권한")
                        }
                      >
                        <option value="팀원">팀원</option>
                        <option value="관리자">관리자</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <button
                        onClick={() => {
                          if (u.username === "admin") {
                            return notify("기본 관리자 계정은 비활성화할 수 없습니다.");
                          }
                          void updateMember(u, { is_active: !u.is_active }, "상태");
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer",
                          u.is_active
                            ? "border-success/30 bg-success/15 text-success"
                            : "border-destructive/30 bg-destructive/15 text-destructive",
                        )}
                      >
                        {u.is_active ? "활성" : "비활성"}
                      </button>
                    </td>
                    <td className="py-3 text-end">
                      {u.username !== "admin" && u.id !== currentUser.id && (
                        <button
                          onClick={async () => {
                            const ok = await runDb(
                              supabase.from("app_users").delete().eq("id", u.id),
                              notify,
                              `${u.name} 회원 삭제 실패`,
                            );
                            if (!ok) return;
                            setUsers((prev) => prev.filter((item) => item.id !== u.id));
                            notify(`${u.name} 회원이 삭제되었습니다.`);
                          }}
                          aria-label={`${u.name} 계정 삭제`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      해당 조직에 등록된 회원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ZenithCard>
      </div>
    </div>
  );
}

/* ============================================================================
 * 5-2. 계정관리 · 조직도 관리
 * ============================================================================ */
function OrgChartView({
  departments,
  setDepartments,
  users,
  setUsers,
  notify,
  onActivity,
}: {
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  notify: (m: string) => void;
  onActivity: (title: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(ROOT_PARENT);
  const [saving, setSaving] = useState(false);

  const tree = flattenDepartments(departments);
  const siblingsOf = (d: Department) =>
    departments
      .filter((x) => x.parent_id === d.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const membersOf = (id: string) => users.filter((u) => u.department_id === id);

  const addDepartment = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return notify("조직명을 입력해주세요.");
    const parent = parentId || null;
    if (departments.some((d) => d.parent_id === parent && d.name === clean)) {
      return notify("같은 상위 조직에 이미 있는 조직명입니다.");
    }
    const sortOrder =
      Math.max(0, ...departments.filter((d) => d.parent_id === parent).map((d) => d.sort_order)) +
      1;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("departments")
        .insert({ name: clean, parent_id: parent, sort_order: sortOrder })
        .select("id, name, parent_id, sort_order")
        .single();
      if (error || !data) {
        return notify(`조직 추가 실패: ${error?.message ?? "알 수 없는 오류"}`);
      }
      setDepartments((prev) => [...prev, data as Department]);
      onActivity("조직 추가", `'${clean}' 조직이 추가되었습니다.`);
      setName("");
      notify(`'${clean}' 조직이 추가되었습니다.`);
    } finally {
      setSaving(false);
    }
  };

  const renameDepartment = async (d: Department, next: string) => {
    if (departments.some((x) => x.id !== d.id && x.parent_id === d.parent_id && x.name === next)) {
      return notify("같은 상위 조직에 이미 있는 조직명입니다.");
    }
    const ok = await runDb(
      supabase.from("departments").update({ name: next }).eq("id", d.id),
      notify,
      "조직명 변경 실패",
    );
    if (!ok) return;
    // 회원 표시용 부서명도 함께 갱신
    await runDb(
      supabase.from("app_users").update({ department: next }).eq("department_id", d.id),
      notify,
      "회원 부서명 갱신 실패",
    );
    setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, name: next } : x)));
    setUsers((prev) =>
      prev.map((u) => (u.department_id === d.id ? { ...u, department: next } : u)),
    );
    notify(`'${d.name}' → '${next}' 이름이 변경되었습니다.`);
  };

  const moveParent = async (d: Department, nextParent: string | null) => {
    if (departments.some((x) => x.parent_id === nextParent && x.name === d.name && x.id !== d.id)) {
      return notify("이동할 상위 조직에 같은 이름의 조직이 있습니다.");
    }
    const sortOrder =
      Math.max(
        0,
        ...departments.filter((x) => x.parent_id === nextParent).map((x) => x.sort_order),
      ) + 1;
    const ok = await runDb(
      supabase
        .from("departments")
        .update({ parent_id: nextParent, sort_order: sortOrder })
        .eq("id", d.id),
      notify,
      "상위 조직 변경 실패",
    );
    if (!ok) return;
    setDepartments((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, parent_id: nextParent, sort_order: sortOrder } : x)),
    );
    notify(`'${d.name}' 조직의 상위 조직이 변경되었습니다.`);
  };

  // 같은 상위 조직 안에서 순서 바꾸기
  const swapOrder = async (d: Department, dir: -1 | 1) => {
    const sibs = siblingsOf(d);
    const idx = sibs.findIndex((x) => x.id === d.id);
    const other = sibs[idx + dir];
    if (!other) return;
    // sort_order 가 같을 수 있으므로 위치 기반으로 다시 매김
    const aOrder = idx + dir + 1;
    const bOrder = idx + 1;
    const ok =
      (await runDb(
        supabase.from("departments").update({ sort_order: aOrder }).eq("id", d.id),
        notify,
        "순서 변경 실패",
      )) &&
      (await runDb(
        supabase.from("departments").update({ sort_order: bOrder }).eq("id", other.id),
        notify,
        "순서 변경 실패",
      ));
    if (!ok) return;
    setDepartments((prev) =>
      prev.map((x) =>
        x.id === d.id
          ? { ...x, sort_order: aOrder }
          : x.id === other.id
            ? { ...x, sort_order: bOrder }
            : x,
      ),
    );
  };

  const deleteDepartment = async (d: Department) => {
    if (departments.some((x) => x.parent_id === d.id)) {
      return notify("하위 조직이 있는 조직은 삭제할 수 없습니다. 하위 조직을 먼저 정리하세요.");
    }
    if (membersOf(d.id).length > 0) {
      return notify("소속 회원이 있는 조직은 삭제할 수 없습니다. 회원 소속을 먼저 변경하세요.");
    }
    const ok = await runDb(
      supabase.from("departments").delete().eq("id", d.id),
      notify,
      "조직 삭제 실패",
    );
    if (!ok) return;
    setDepartments((prev) => prev.filter((x) => x.id !== d.id));
    onActivity("조직 삭제", `'${d.name}' 조직이 삭제되었습니다.`);
    notify(`'${d.name}' 조직이 삭제되었습니다.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">조직도 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          상위·하위 조직을 구성하고 조직별 소속 회원을 확인합니다. 회원의 소속은 회원 관리에서
          지정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ZenithCard className="col-span-full xl:col-span-4 p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">조직 추가</h2>
              <p className="text-xs text-muted-foreground">
                상위 조직을 비우면 최상위 조직이 됩니다
              </p>
            </div>
          </div>
          <form onSubmit={addDepartment} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">
                조직명 <span className="text-destructive">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="예: 인사팀"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">상위 조직</label>
              <select
                aria-label="상위 조직"
                className={inputCls}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value={ROOT_PARENT}>(최상위 조직)</option>
                <DepartmentOptions departments={departments} />
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className={cn(btnPrimary, "w-full", saving && "opacity-70")}
            >
              <Plus className="h-4 w-4" />
              <span>{saving ? "추가 중..." : "조직 추가"}</span>
            </button>
          </form>
        </ZenithCard>

        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="pb-4">
            <h2 className="text-base font-semibold">조직도 ({departments.length}개 조직)</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              연필 아이콘으로 이름을 바꾸고, 화살표로 같은 단계 안의 순서를 바꿉니다.
            </p>
          </div>

          {tree.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              등록된 조직이 없습니다. 왼쪽에서 첫 조직을 추가하세요.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tree.map(({ dept, depth }) => {
                const members = membersOf(dept.id);
                const sibs = siblingsOf(dept);
                const pos = sibs.findIndex((x) => x.id === dept.id);
                const blocked = descendantIds(departments, dept.id);
                return (
                  <li
                    key={dept.id}
                    className="rounded-lg border border-border bg-card px-3 py-2.5"
                    style={{ marginLeft: depth * 24 }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Network className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-semibold">{dept.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {members.length}명
                      </span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <select
                          aria-label={`${dept.name} 상위 조직`}
                          className={cn(inputCls, "h-8 w-36 text-xs")}
                          value={dept.parent_id ?? ROOT_PARENT}
                          onChange={(e) => void moveParent(dept, e.target.value || null)}
                        >
                          <option value={ROOT_PARENT}>(최상위)</option>
                          {flattenDepartments(departments)
                            .filter(({ dept: d }) => !blocked.has(d.id))
                            .map(({ dept: d, depth: dd }) => (
                              <option key={d.id} value={d.id}>
                                {`${"  ".repeat(dd)}${d.name}`}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => void swapOrder(dept, -1)}
                          disabled={pos <= 0}
                          aria-label={`${dept.name} 위로`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void swapOrder(dept, 1)}
                          disabled={pos >= sibs.length - 1}
                          aria-label={`${dept.name} 아래로`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <InlineNameEdit
                          value={dept.name}
                          label={dept.name}
                          onSave={(next) => renameDepartment(dept, next)}
                        />
                        <button
                          onClick={() => void deleteDepartment(dept)}
                          aria-label={`${dept.name} 조직 삭제`}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {members.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px]"
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ZenithCard>
      </div>
    </div>
  );
}

/* ============================================================================
 * 5-3. 계정관리 · 직급 관리
 * ============================================================================ */
function PositionsView({
  positions,
  setPositions,
  users,
  notify,
  onActivity,
}: {
  positions: Position[];
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  users: AppUser[];
  notify: (m: string) => void;
  onActivity: (title: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const sorted = [...positions].sort((a, b) => a.rank - b.rank);
  const membersOf = (id: string) => users.filter((u) => u.position_id === id);

  const addPosition = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return notify("직급명을 입력해주세요.");
    if (positions.some((p) => p.name === clean)) return notify("이미 등록된 직급입니다.");
    const rank = Math.max(0, ...positions.map((p) => p.rank)) + 10;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("positions")
        .insert({ name: clean, rank })
        .select("id, name, rank")
        .single();
      if (error || !data) {
        return notify(`직급 추가 실패: ${error?.message ?? "알 수 없는 오류"}`);
      }
      setPositions((prev) => [...prev, data as Position]);
      onActivity("직급 추가", `'${clean}' 직급이 추가되었습니다.`);
      setName("");
      notify(`'${clean}' 직급이 추가되었습니다.`);
    } finally {
      setSaving(false);
    }
  };

  const renamePosition = async (p: Position, next: string) => {
    if (positions.some((x) => x.id !== p.id && x.name === next)) {
      return notify("이미 등록된 직급명입니다.");
    }
    const ok = await runDb(
      supabase.from("positions").update({ name: next }).eq("id", p.id),
      notify,
      "직급명 변경 실패",
    );
    if (!ok) return;
    setPositions((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: next } : x)));
    notify(`'${p.name}' → '${next}' 이름이 변경되었습니다.`);
  };

  // 위/아래 직급과 서열(rank) 교환
  const swapRank = async (p: Position, dir: -1 | 1) => {
    const idx = sorted.findIndex((x) => x.id === p.id);
    const other = sorted[idx + dir];
    if (!other) return;
    const ok =
      (await runDb(
        supabase.from("positions").update({ rank: other.rank }).eq("id", p.id),
        notify,
        "서열 변경 실패",
      )) &&
      (await runDb(
        supabase.from("positions").update({ rank: p.rank }).eq("id", other.id),
        notify,
        "서열 변경 실패",
      ));
    if (!ok) return;
    setPositions((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, rank: other.rank } : x.id === other.id ? { ...x, rank: p.rank } : x,
      ),
    );
  };

  const deletePosition = async (p: Position) => {
    if (membersOf(p.id).length > 0) {
      return notify("이 직급의 회원이 있어 삭제할 수 없습니다. 회원 직급을 먼저 변경하세요.");
    }
    const ok = await runDb(
      supabase.from("positions").delete().eq("id", p.id),
      notify,
      "직급 삭제 실패",
    );
    if (!ok) return;
    setPositions((prev) => prev.filter((x) => x.id !== p.id));
    onActivity("직급 삭제", `'${p.name}' 직급이 삭제되었습니다.`);
    notify(`'${p.name}' 직급이 삭제되었습니다.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">직급 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          직급과 서열을 관리합니다. 위에 있을수록 높은 직급이며, 회원 목록도 이 순서로 정렬됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ZenithCard className="col-span-full xl:col-span-4 p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">직급 추가</h2>
              <p className="text-xs text-muted-foreground">새 직급은 가장 아래 서열로 추가됩니다</p>
            </div>
          </div>
          <form onSubmit={addPosition} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">
                직급명 <span className="text-destructive">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="예: 과장"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className={cn(btnPrimary, "w-full", saving && "opacity-70")}
            >
              <Plus className="h-4 w-4" />
              <span>{saving ? "추가 중..." : "직급 추가"}</span>
            </button>
          </form>
        </ZenithCard>

        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="pb-4">
            <h2 className="text-base font-semibold">직급 서열 ({positions.length}개)</h2>
          </div>
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              등록된 직급이 없습니다. 왼쪽에서 첫 직급을 추가하세요.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {sorted.map((p, idx) => {
                const members = membersOf(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {members.length}명
                    </span>
                    {members.length > 0 && (
                      <span className="truncate text-xs text-muted-foreground">
                        {members.map((m) => m.name).join(", ")}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        onClick={() => void swapRank(p, -1)}
                        disabled={idx === 0}
                        aria-label={`${p.name} 위로`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void swapRank(p, 1)}
                        disabled={idx === sorted.length - 1}
                        aria-label={`${p.name} 아래로`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <InlineNameEdit
                        value={p.name}
                        label={p.name}
                        onSave={(next) => renamePosition(p, next)}
                      />
                      <button
                        onClick={() => void deletePosition(p)}
                        aria-label={`${p.name} 직급 삭제`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </ZenithCard>
      </div>
    </div>
  );
}

/* ============================================================================
 * 6-1. 운영 · 주차 선택 / 주간 보고 확정 / 제출 현황 / 배포·취합 / 변경 이력
 * ============================================================================ */

// DB 의 최신 업무 목록 (제출 현황 · 취합은 화면 상태가 아니라 DB 기준으로 판단)
async function fetchTasks(): Promise<Task[] | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  return error || !Array.isArray(data) ? null : (data as Task[]);
}

function WeekPicker({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const thisWeek = weekStartOf();
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-input bg-background p-0.5">
      <button
        onClick={() => onChange(addWeeks(week, -1))}
        aria-label="이전 주"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent cursor-pointer"
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
      <span className="min-w-36 px-1 text-center text-xs font-semibold">
        {weekLabel(week)}
        {week === thisWeek && <span className="ml-1 text-primary">(이번 주)</span>}
      </span>
      <button
        onClick={() => onChange(addWeeks(week, 1))}
        disabled={week >= thisWeek}
        aria-label="다음 주"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30 cursor-pointer"
      >
        <ChevronsRight className="h-4 w-4" />
      </button>
    </div>
  );
}

type WeeklyReport = {
  week_start: string;
  snapshot: Task[];
  confirmed_by_name: string;
  confirmed_at: string;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
};

function ReportView({
  tasks,
  currentUser,
  notify,
}: {
  tasks: Task[];
  currentUser: AppUser;
  notify: (m: string) => void;
}) {
  const [week, setWeek] = useState(() => weekStartOf());
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [prevReport, setPrevReport] = useState<TaskLike[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const isAdmin = currentUser.role === "관리자";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("weekly_reports")
      .select("week_start, snapshot, confirmed_by_name, confirmed_at")
      .eq("week_start", week)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setReport((data as WeeklyReport | null) ?? null);
        setLoading(false);
      });
    supabase
      .from("weekly_reports")
      .select("snapshot")
      .eq("week_start", addWeeks(week, -1))
      .maybeSingle()
      .then(({ data }) => {
        const snap = (data as { snapshot?: unknown } | null)?.snapshot;
        if (alive) setPrevReport(Array.isArray(snap) ? (snap as TaskLike[]) : null);
      });
    return () => {
      alive = false;
    };
  }, [week]);

  const confirm = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("weekly_reports")
        .insert({ week_start: week, snapshot: tasks, confirmed_by_name: currentUser.name })
        .select("week_start, snapshot, confirmed_by_name, confirmed_at")
        .single();
      if (error || !data) {
        return notify(`보고서 확정 실패: ${error?.message ?? "알 수 없는 오류"}`);
      }
      setReport(data as WeeklyReport);
      notify(`${weekLabel(week)} 주간 보고서가 최종 확정되었습니다.`);
    } finally {
      setBusy(false);
    }
  };

  const unconfirm = async () => {
    setBusy(true);
    try {
      const ok = await runDb(
        supabase.from("weekly_reports").delete().eq("week_start", week),
        notify,
        "확정 해제 실패",
      );
      if (!ok) return;
      setReport(null);
      notify(`${weekLabel(week)} 보고서 확정이 해제되었습니다.`);
    } finally {
      setBusy(false);
    }
  };

  const confirmed = !!report;
  const isCurrentWeek = week === weekStartOf();
  const shown = report?.snapshot ?? (isCurrentWeek ? tasks : []);

  return (
    <div className="space-y-4">
      <ZenithCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <WeekPicker week={week} onChange={setWeek} />
          {loading ? (
            <span className="text-xs text-muted-foreground">확정 여부 확인 중...</span>
          ) : confirmed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
              <Lock className="h-3 w-3" />
              최종 확정 · {report.confirmed_by_name || "관리자"} ·{" "}
              {formatDateTime(report.confirmed_at)}
            </span>
          ) : (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning-foreground dark:text-warning">
              작성 중 (미확정)
            </span>
          )}
        </div>
        {isAdmin && !loading && (
          <div className="flex items-center gap-2">
            {confirmed ? (
              <button onClick={() => void unconfirm()} disabled={busy} className={btnOutline}>
                <span>확정 해제</span>
              </button>
            ) : (
              <button
                onClick={() => void confirm()}
                disabled={busy || !isCurrentWeek}
                title={
                  isCurrentWeek ? undefined : "지난 주는 당시 데이터가 없어 확정할 수 없습니다"
                }
                className={cn(btnPrimary, (busy || !isCurrentWeek) && "opacity-60")}
              >
                <Lock className="h-4 w-4" />
                <span>최종 확정</span>
              </button>
            )}
          </div>
        )}
      </ZenithCard>

      {!loading && !confirmed && !isCurrentWeek ? (
        <ZenithCard className="p-10 text-center text-sm text-muted-foreground">
          {weekLabel(week)} 주차는 확정된 보고서가 없습니다. 보고서는 해당 주에 최종 확정해야
          기록됩니다.
        </ZenithCard>
      ) : (
        <ReportContent
          tasks={shown}
          notify={notify}
          prevTasks={prevReport}
          today={
            // 확정본은 확정 시점 기준으로 마감 초과를 판단
            report ? report.confirmed_at.slice(0, 10) : todayIso()
          }
          title={`주간업무보고서 (${weekLabel(week)})`}
          headerExtra={
            confirmed ? (
              <span className="text-xs text-muted-foreground">
                확정본 — 수정되지 않는 보관본입니다
              </span>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function SubmissionStatusView({
  users,
  departments,
  currentUser,
  notify,
}: {
  users: AppUser[];
  departments: Department[];
  currentUser: AppUser;
  notify: (m: string) => void;
}) {
  const [week, setWeek] = useState(() => weekStartOf());
  const [dbTasks, setDbTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    const fresh = await fetchTasks();
    setLoading(false);
    if (!fresh) return notify("업무 데이터를 불러오지 못했습니다.");
    setDbTasks(fresh);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = buildSubmissionStatus(users, dbTasks ?? [], departments, week);
  const total = rows.reduce((n, r) => n + r.members.length, 0);
  const submitted = rows.reduce((n, r) => n + r.submittedCount, 0);
  const overallRate = total ? Math.round((submitted / total) * 100) : 0;

  const copyReminder = async () => {
    try {
      await navigator.clipboard.writeText(reminderText(rows, week));
      notify("독촉 문구가 클립보드에 복사되었습니다.");
    } catch {
      notify("복사에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">제출 현황</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            선택한 주에 본인 담당 업무를 1건 이상 갱신한 회원을 &lsquo;제출&rsquo;로 봅니다. (담당자
            이름 기준)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WeekPicker week={week} onChange={setWeek} />
          <button onClick={() => void reload()} className={btnOutline} aria-label="새로고침">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          {currentUser.role === "관리자" && (
            <button onClick={() => void copyReminder()} className={btnPrimary}>
              <Copy className="h-4 w-4" />
              <span>미제출자 독촉 문구 복사</span>
            </button>
          )}
        </div>
      </div>

      <ZenithCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">전체 입력률</p>
            <p className="mt-1 text-3xl font-bold">{overallRate}%</p>
          </div>
          <p className="text-sm text-muted-foreground">
            제출 <b className="text-foreground">{submitted}</b> / 대상 {total}명
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${overallRate}%` }}
          />
        </div>
      </ZenithCard>

      <ZenithCard className="p-6">
        <h2 className="pb-4 text-base font-semibold">조직별 입력률</h2>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">집계할 회원이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.department?.id ?? "none"}
                className="rounded-lg border border-border p-3"
                style={{ marginLeft: r.depth * 24 }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">{r.department?.name ?? "소속 없음"}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.submittedCount} / {r.members.length}명
                  </span>
                  <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        r.rate === 100
                          ? "bg-success"
                          : r.rate >= 50
                            ? "bg-primary"
                            : "bg-destructive",
                      )}
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                  <span className="w-10 text-end text-xs font-semibold">
                    {r.members.length ? `${r.rate}%` : "-"}
                  </span>
                </div>
                {r.members.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.members.map((m) => (
                      <span
                        key={m.member.id}
                        title={`담당 업무 ${m.taskCount}건 · 이번 주 갱신 ${m.updatedCount}건`}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          m.submitted
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        {m.member.name} {m.submitted ? "✓" : "미제출"}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ZenithCard>
    </div>
  );
}

const DIST_STATUSES: readonly string[] = STATUSES;

function DistributionView({
  users,
  departments,
  notify,
  onApplied,
}: {
  users: AppUser[];
  departments: Department[];
  notify: (m: string) => void;
  onApplied: (merged: Task[]) => void;
}) {
  const [deptId, setDeptId] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ fileName: string; result: MergeResult } | null>(null);

  const writeSheet = async (rows: Task[], fileName: string) => {
    const XLSX = await import("xlsx");
    const header = DIST_COLUMNS.map((c) => c.header);
    const body = toDistRows(rows).map((r) => DIST_COLUMNS.map((c) => r[c.key] ?? ""));
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = DIST_COLUMNS.map((c) => ({
      wch:
        c.key === "title" || c.key === "progress" || c.key === "issue"
          ? 32
          : c.key === "id"
            ? 14
            : 16,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "업무");
    XLSX.writeFile(wb, fileName);
  };

  const distribute = async () => {
    if (!deptId) return notify("배포할 조직을 선택해주세요.");
    setBusy(true);
    try {
      const fresh = await fetchTasks();
      if (!fresh) return notify("업무 데이터를 불러오지 못했습니다.");
      const dept = departments.find((d) => d.id === deptId)!;
      const rows = tasksForDepartment(fresh, users, departments, deptId);
      await writeSheet(
        rows,
        `주간업무_배포_${dept.name.replace(/[\\/:*?"<>|]/g, "_")}_${weekStartOf()}.xlsx`,
      );
      notify(`'${dept.name}' 배포 파일(${rows.length}건)을 내려받았습니다.`);
    } finally {
      setBusy(false);
    }
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const fresh = await fetchTasks();
      if (!fresh) return notify("업무 데이터를 불러오지 못했습니다.");
      await writeSheet(fresh, `주간업무_취합본_${weekStartOf()}.xlsx`);
      notify(`취합본(${fresh.length}건)을 내려받았습니다.`);
    } finally {
      setBusy(false);
    }
  };

  const readUpload = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) return notify("시트를 찾을 수 없습니다.");
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      const rows = parseDistSheet(records);
      if (rows.length === 0 || !(DIST_COLUMNS[0].header in (records[0] ?? {}))) {
        return notify("배포 파일 형식이 아닙니다. 이 화면에서 내려받은 파일을 채워 올려주세요.");
      }
      const fresh = await fetchTasks();
      if (!fresh) return notify("업무 데이터를 불러오지 못했습니다.");
      const result = mergeDistRows(fresh, rows, {
        statuses: DIST_STATUSES,
        newId: uid,
        newCode: nextCode,
      });
      setPreview({ fileName: file.name, result });
    } catch {
      notify("파일을 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    const { updated, created } = preview.result;
    const changed = [...updated, ...created] as Task[];
    if (changed.length === 0) {
      setPreview(null);
      return notify("반영할 변경 사항이 없습니다.");
    }
    setBusy(true);
    try {
      const ok = await runDb(
        supabase.from("tasks").upsert(changed.map(({ updated_at: _u, ...t }) => t)),
        notify,
        "취합 반영 실패",
      );
      if (!ok) return;
      const fresh = await fetchTasks();
      const ids = new Set(changed.map((t) => t.id));
      onApplied(fresh ? fresh.filter((t) => ids.has(t.id)) : changed);
      notify(`취합 반영 완료: 수정 ${updated.length}건 · 추가 ${created.length}건`);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const r = preview?.result;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">배포 · 취합</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          조직마다 자기 담당 업무만 든 엑셀을 내려보내고, 채워 돌아온 파일을 올려 병합합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ZenithCard className="p-6 space-y-4">
          <h2 className="text-base font-semibold">1. 배포 파일 내려받기</h2>
          <p className="text-xs text-muted-foreground">
            선택한 조직(하위 조직 포함) 소속 회원이 담당자인 업무가 들어갑니다. 새 업무는 ID 칸을
            비워 두고 행을 추가하면 됩니다.
          </p>
          <select
            aria-label="배포 조직"
            className={inputCls}
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
          >
            <option value="">조직 선택</option>
            <DepartmentOptions departments={departments} />
          </select>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void distribute()} disabled={busy} className={btnPrimary}>
              <Download className="h-4 w-4" />
              <span>조직별 배포 파일</span>
            </button>
            <button onClick={() => void exportAll()} disabled={busy} className={btnOutline}>
              <FileSpreadsheet className="h-4 w-4" />
              <span>전체 취합본 엑셀</span>
            </button>
          </div>
        </ZenithCard>

        <ZenithCard className="p-6 space-y-4">
          <h2 className="text-base font-semibold">2. 채워진 파일 올려 취합</h2>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>빈 칸은 채우고, 파일의 빈 칸은 기존 값을 지우지 않습니다.</li>
            <li>배포 이후 시스템에서도 바뀐 칸은 시스템 값을 지키고 충돌 보고서에 남깁니다.</li>
            <li>반영 전에 결과를 미리 보여드립니다.</li>
          </ul>
          <label className={cn(btnOutline, "w-full justify-center", busy && "opacity-60")}>
            <UploadIcon className="h-4 w-4" />
            <span>엑셀 파일 선택 (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void readUpload(f);
              }}
            />
          </label>
        </ZenithCard>
      </div>

      {preview && r && (
        <ZenithCard className="p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">취합 미리보기 · {preview.fileName}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                수정 {r.updated.length}건 (빈 칸 채움 {r.filled} · 덮어씀 {r.changed}) · 추가{" "}
                {r.created.length}건 · 충돌 {r.conflicts.length}칸
                {r.unknownIds.length > 0 && ` · 없는 업무 ${r.unknownIds.length}건`}
                {r.invalidStatus > 0 && ` · 잘못된 상태값 ${r.invalidStatus}칸 무시`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className={btnOutline}>
                취소
              </button>
              <button onClick={() => void apply()} disabled={busy} className={btnPrimary}>
                <Check className="h-4 w-4" />
                <span>취합 반영</span>
              </button>
            </div>
          </div>

          {r.conflicts.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-warning/30">
              <p className="border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold">
                충돌 보고 — 배포 후 시스템에서도 수정되어 시스템 값을 지킨 칸
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-start">업무</th>
                    <th className="px-3 py-2 text-start">항목</th>
                    <th className="px-3 py-2 text-start">지킨 값 (시스템)</th>
                    <th className="px-3 py-2 text-start">버린 값 (파일)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.conflicts.map((c) => (
                    <tr
                      key={`${c.taskId}-${c.field}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium">{c.title}</td>
                      <td className="px-3 py-2">{FIELD_LABELS[c.field as MergeField]}</td>
                      <td className="px-3 py-2">{c.kept}</td>
                      <td className="px-3 py-2 text-muted-foreground line-through">{c.incoming}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {r.unknownIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              시스템에 없는 업무 ID(삭제된 업무로 보고 건너뜀): {r.unknownIds.join(", ")}
            </p>
          )}
        </ZenithCard>
      )}
    </div>
  );
}

type AuditLog = {
  id: number;
  table_name: string;
  record_id: string;
  action: "insert" | "update" | "delete";
  actor_name: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const AUDIT_TABLES: Record<string, string> = {
  tasks: "업무",
  app_users: "회원",
  departments: "조직",
  positions: "직급",
  weekly_reports: "보고 확정",
  upload_files: "올린 파일",
};
const AUDIT_ACTIONS: Record<AuditLog["action"], string> = {
  insert: "추가",
  update: "수정",
  delete: "삭제",
};
const AUDIT_HIDDEN_KEYS = new Set(["id", "created_at", "updated_at", "auth_user_id", "snapshot"]);
const AUDIT_PAGE = 100;

const auditValue = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "(빈 값)"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

function AuditLogView({ notify }: { notify: (m: string) => void }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [table, setTable] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = async (append: boolean) => {
    setLoading(true);
    try {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(AUDIT_PAGE);
      if (table) q = q.eq("table_name", table);
      const last = append ? logs[logs.length - 1] : undefined;
      if (last) q = q.lt("id", last.id);
      const { data, error } = await q;
      if (error || !Array.isArray(data)) return notify("변경 이력을 불러오지 못했습니다.");
      setLogs((prev) => (append ? [...prev, ...(data as AuditLog[])] : (data as AuditLog[])));
      setHasMore(data.length === AUDIT_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const label = (l: AuditLog) => {
    const row = { ...(l.old_data ?? {}), ...(l.new_data ?? {}) };
    return String(
      row["title"] ?? row["name"] ?? row["file_name"] ?? row["week_start"] ?? l.record_id,
    );
  };

  const changes = (l: AuditLog) => {
    const keys = Object.keys(l.new_data ?? l.old_data ?? {}).filter(
      (k) => !AUDIT_HIDDEN_KEYS.has(k),
    );
    if (l.action !== "update")
      return keys.length
        ? keys.map((k) => `${k}: ${auditValue((l.new_data ?? l.old_data)?.[k])}`)
        : [];
    return keys.map((k) => `${k}: ${auditValue(l.old_data?.[k])} → ${auditValue(l.new_data?.[k])}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">변경 이력</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            누가 언제 무엇을 바꿨는지 DB 에서 자동으로 기록합니다. 이력은 수정하거나 지울 수
            없습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="대상 필터"
            className={cn(inputCls, "w-36")}
            value={table}
            onChange={(e) => setTable(e.target.value)}
          >
            <option value="">전체 대상</option>
            {Object.entries(AUDIT_TABLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button onClick={() => void load(false)} className={btnOutline} aria-label="새로고침">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <ZenithCard className="p-6">
        {logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? "불러오는 중..." : "기록된 변경 이력이 없습니다."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 pr-3 text-start font-medium">시각</th>
                  <th className="pb-3 pr-3 text-start font-medium">작업자</th>
                  <th className="pb-3 pr-3 text-start font-medium">대상</th>
                  <th className="pb-3 pr-3 text-start font-medium">작업</th>
                  <th className="pb-3 text-start font-medium">변경 내용</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 align-top last:border-0">
                    <td className="py-2.5 pr-3 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium whitespace-nowrap">
                      {l.actor_name || "-"}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className="text-muted-foreground">
                        {AUDIT_TABLES[l.table_name] ?? l.table_name}
                      </span>
                      <span className="block font-medium">{label(l)}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          l.action === "insert" && "border-success/30 bg-success/10 text-success",
                          l.action === "update" && "border-primary/25 bg-primary/10 text-primary",
                          l.action === "delete" &&
                            "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        {AUDIT_ACTIONS[l.action]}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {changes(l).map((c) => (
                        <div key={c} className="break-all">
                          {c}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="pt-4 text-center">
            <button onClick={() => void load(true)} disabled={loading} className={btnOutline}>
              더 보기
            </button>
          </div>
        )}
      </ZenithCard>
    </div>
  );
}
/* ============================================================================
 * 6. NEW TASK MODAL
 * ============================================================================ */
function NewTaskModal({
  onClose,
  onCreate,
  notify,
}: {
  onClose: () => void;
  onCreate: (t: Task) => void;
  notify: (m: string) => void;
}) {
  const empty = {
    field: FIELDS[0] as string,
    title: "",
    owner: "",
    due: "2026-11-15",
    status: "대기" as Status,
    progress: "",
    issue: "",
  };
  const [f, setF] = useState(empty);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <ZenithCard className="w-full max-w-md p-6 shadow-xl">
        <div onClick={(e) => e.stopPropagation()} className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">새 업무 등록</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            className={inputCls}
            placeholder="업무명"
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <select
              className={inputCls}
              value={f.field}
              onChange={(e) => setF({ ...f, field: e.target.value })}
            >
              {FIELDS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              className={inputCls}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as Status })}
            >
              {STATUSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              className={inputCls}
              placeholder="담당자"
              value={f.owner}
              onChange={(e) => setF({ ...f, owner: e.target.value })}
            />
            <input
              type="date"
              className={inputCls}
              value={f.due}
              onChange={(e) => setF({ ...f, due: e.target.value })}
            />
          </div>
          <input
            className={inputCls}
            placeholder="추진현황"
            value={f.progress}
            onChange={(e) => setF({ ...f, progress: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="이슈 (없으면 비워두세요)"
            value={f.issue}
            onChange={(e) => setF({ ...f, issue: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button className={btnOutline} onClick={onClose}>
              취소
            </button>
            <button
              className={btnPrimary}
              onClick={() => {
                if (!f.title.trim()) return notify("업무명을 입력해주세요.");
                onCreate({
                  ...f,
                  owner: f.owner.trim() || "담당자",
                  id: uid(),
                  code: nextCode(),
                });
              }}
            >
              등록
            </button>
          </div>
        </div>
      </ZenithCard>
    </div>
  );
}

/* ============================================================================
 * 7. ZENITH COMMAND PALETTE (⌘K)
 * ============================================================================ */
function CommandPaletteModal({
  tasks,
  onClose,
  onSelectView,
  onNewTask,
  onToggleTheme,
  onLogout,
}: {
  tasks: Task[];
  onClose: () => void;
  onSelectView: (v: ViewId) => void;
  onNewTask: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const pages = [
    { id: "dashboard" as ViewId, label: "대시보드 (Overview)", icon: LayoutDashboard },
    { id: "upload" as ViewId, label: "1. 자료 올리기 (엑셀/CSV)", icon: UploadIcon },
    { id: "kanban" as ViewId, label: "2. 진행상태 (칸반 보드)", icon: KanbanIcon },
    { id: "report" as ViewId, label: "3. 주간업무보고서", icon: FileText },
    { id: "status" as ViewId, label: "운영 · 제출 현황", icon: ClipboardCheck },
    { id: "distribute" as ViewId, label: "운영 · 배포 · 취합", icon: FileSpreadsheet },
    { id: "audit" as ViewId, label: "운영 · 변경 이력", icon: History },
    { id: "members" as ViewId, label: "계정관리 · 회원 관리", icon: Users },
    { id: "org" as ViewId, label: "계정관리 · 조직도 관리", icon: Network },
    { id: "positions" as ViewId, label: "계정관리 · 직급 관리", icon: Award },
  ].filter((p) => !query || p.label.toLowerCase().includes(query));

  const matchingTasks = tasks
    .filter(
      (t) =>
        !query ||
        t.title.toLowerCase().includes(query) ||
        t.owner.toLowerCase().includes(query) ||
        t.field.toLowerCase().includes(query),
    )
    .slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="me-2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="페이지 이동, 업무 검색 또는 명령어 입력..."
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
          <button
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
          >
            ESC
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {pages.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pages
              </p>
              {pages.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectView(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {matchingTasks.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tasks ({matchingTasks.length})
              </p>
              {matchingTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectView("kanban")}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-accent cursor-pointer"
                >
                  <div className="truncate text-start">
                    <span className="font-medium">{t.title}</span>
                    <span className="ms-2 text-muted-foreground">({t.owner})</span>
                  </div>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                      statusBadgeStyle[t.status],
                    )}
                  >
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Actions
            </p>
            <button
              onClick={onNewTask}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span>새 업무 등록</span>
            </button>
            <button
              onClick={onToggleTheme}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
            >
              <Sun className="h-4 w-4 text-muted-foreground" />
              <span>라이트 / 다크 테마 전환</span>
            </button>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 8. ZENITH LIVE THEME CUSTOMIZER DRAWER
 * ============================================================================ */
function ThemeCustomizerDrawer({
  theme,
  setTheme,
  colorPreset,
  setColorPreset,
  density,
  setDensity,
  layout,
  setLayout,
  container,
  setContainer,
  onReset,
  onClose,
}: {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  colorPreset: ColorPreset;
  setColorPreset: (c: ColorPreset) => void;
  density: DensityMode;
  setDensity: (d: DensityMode) => void;
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
  container: ContainerMode;
  setContainer: (c: ContainerMode) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-80 flex-col border-l border-border bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Customize</h2>
            <p className="text-xs text-muted-foreground">
              업무보고 화면 스타일을 맞춤 설정하세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Theme
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = theme === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setTheme(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Color Preset
            </p>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const active = colorPreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    onClick={() => setColorPreset(preset.key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground",
                    )}
                  >
                    <span
                      data-preset-swatch={preset.key}
                      className={cn(
                        "inline-block h-5 w-5 rounded-full",
                        active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                    />
                    <span className="text-xs font-medium">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Density
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfort" },
                  { value: "spacious", label: "Spacious" },
                ] as const
              ).map((d) => {
                const active = density === d.value;
                return (
                  <button
                    key={d.value}
                    onClick={() => setDensity(d.value)}
                    className={cn(
                      "rounded-lg border-2 p-2.5 text-xs font-medium transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation Layout
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "sidebar", label: "Sidebar", icon: PanelLeft },
                  { value: "topnav", label: "Top Nav", icon: PanelTop },
                ] as const
              ).map((l) => {
                const Icon = l.icon;
                const active = layout === l.value;
                return (
                  <button
                    key={l.value}
                    onClick={() => setLayout(l.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Container
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "fluid", label: "Fluid", icon: Maximize2 },
                  { value: "boxed", label: "Boxed", icon: Minimize2 },
                ] as const
              ).map((c) => {
                const Icon = c.icon;
                const active = container === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setContainer(c.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button onClick={onReset} className={cn(btnOutline, "w-full")}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
