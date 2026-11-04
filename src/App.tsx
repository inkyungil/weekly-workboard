import {
  useState,
  useEffect,
  useMemo,
  type DragEvent,
  type ReactNode,
  type FormEvent,
} from "react";
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
  ShieldCheck,
  FileSpreadsheet,
  CheckCheck,
  PanelLeft,
  PanelTop,
  Maximize2,
  Minimize2,
  Database,
  Lock,
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
  supabase,
  supabaseAdminRegistrar,
  SUPABASE_URL,
  SUPABASE_PROJECT_REF,
  SUPABASE_INIT_SQL,
  fetchProfile,
  mapAppUserRow,
  loadLocalUsers,
  saveLocalUsers,
  type AppUser,
  type UserRole,
} from "@/lib/supabase";

export const FIELDS = ["복리후생/총무", "사회공헌/의전", "자산", "비상계획"] as const;
export const STATUSES = ["대기", "진행 중", "지연 / 이슈", "완료"] as const;
export type Status = (typeof STATUSES)[number];

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
};

type ActivityItem = {
  id: string;
  type: "task" | "complete" | "issue" | "upload" | "report";
  title: string;
  description: string;
  time: string;
  read: boolean;
};

type ViewId = "dashboard" | "upload" | "kanban" | "report" | "users";
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

function parsePaste(text: string): Task[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|,|\|/).map((c) => c.trim()))
    .filter((c) => c.length >= 2 && c[1] !== "업무명")
    .map((c) => ({
      id: uid(),
      code: nextCode(),
      field: FIELDS.includes(c[0] as never) ? (c[0] as string) : "복리후생/총무",
      title: c[1] ?? "",
      owner: c[2] ?? "미지정",
      due: c[3] ?? "2026-11-15",
      status: (STATUSES.includes(c[4] as never) ? c[4] : "대기") as Status,
      progress: c[5] ?? "",
      issue: c[6] ?? "",
    }));
}

export default function App() {
  // Supabase Auth: 로그인 화면부터 시작하며, 회원가입은 관리자가 직접 수동 등록으로 진행
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [users, setUsers] = useState<AppUser[]>(() => loadLocalUsers());
  const [currentUser, setCurrentUser] = useState<AppUser>(
    () => loadLocalUsers()[0]!,
  );
  const [tasks, setTasks] = useState<Task[]>(SAMPLE);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
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
      }
    }

    initSupabase();
    return () => {
      mounted = false;
    };
  }, []);

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

  const handleAddTasks = async (newTasks: Task[]) => {
    setTasks((prev) => [...newTasks, ...prev]);
    addActivity({
      type: "upload",
      title: `업무 자료 ${newTasks.length}건 반영 완료`,
      description: `${newTasks[0]?.title ?? "신규 업무"} 외 ${Math.max(0, newTasks.length - 1)}건 업로드됨`,
    });
    notify(`${newTasks.length}건이 반영되었습니다.`);
    try {
      await supabase.from("tasks").upsert(
        newTasks.map((t) => ({
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
    } catch {
      // ignore
    }
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
      key: "system",
      label: "System · 계정/설정",
      items: [
        {
          id: "users" as ViewId,
          label: "4. 사용자 수동 등록 (관리자)",
          icon: Users,
          badge: String(users.length),
        },
      ],
    },
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
              Zenith
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
                  {currentUser.department} · {currentUser.role}
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
                      <span className="text-sm font-bold leading-none tracking-tight">Zenith</span>
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
                    onClick={() => setActiveView("users")}
                    className="hidden h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent lg:inline-flex cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    <span>사용자 수동 등록</span>
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
                  title="Zenith 테마 커스터마이저"
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
                        <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                      </div>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setActiveView("users");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        사용자 수동 등록 관리
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
              className="flex items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6 overflow-x-auto"
            >
              <div className="flex items-center gap-1">
                {[
                  { id: "dashboard" as ViewId, label: "대시보드 (Overview)", icon: LayoutDashboard },
                  { id: "upload" as ViewId, label: "1. 자료 올리기", icon: UploadIcon },
                  { id: "kanban" as ViewId, label: "2. 진행상태 (칸반 보드)", icon: KanbanIcon },
                  { id: "report" as ViewId, label: "3. 주간업무보고서", icon: FileText },
                  { id: "users" as ViewId, label: "4. 사용자 수동 등록", icon: Users },
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
              <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">
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
          <main id="main-content" className="flex-1 p-4 sm:p-6">
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
                onAdd={handleAddTasks}
                onNavigate={setActiveView}
              />
            )}
            {activeView === "kanban" && (
              <KanbanView
                tasks={tasks}
                setTasks={setTasks}
                notify={notify}
                onOpenNewTask={() => setNewTaskModalOpen(true)}
                onSyncTask={syncTaskToSupabase}
              />
            )}
            {activeView === "report" && <ReportView tasks={tasks} notify={notify} />}
            {activeView === "users" && (
              <AdminUserManagementView
                users={users}
                setUsers={setUsers}
                currentUser={currentUser}
                dbTableReady={dbTableReady}
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
    const trimmedId = id.trim();
    if (!trimmedId || !pw) {
      return setErr("아이디와 비밀번호를 입력해주세요.");
    }

    setLoading(true);
    try {
      // 아이디(username) 또는 이메일로 Supabase Auth 로그인 — 비밀번호 검증은 서버에서만 수행
      const email = trimmedId.includes("@") ? trimmedId : `${trimmedId}@zenith.kr`;
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
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
              <span className="text-sm font-bold tracking-tight">Zenith</span>
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
            <label className="mb-1.5 block text-xs font-medium">아이디(이메일)</label>
            <input
              className={inputCls}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="admin 또는 admin@zenith.kr"
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
              <b>관리자가 [사용자 수동 등록] 메뉴에서 직접 계정을 발급</b>합니다.
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
          <button onClick={() => onNavigate("users")} className={btnOutline}>
            <UserPlus className="h-4 w-4 text-primary" />
            <span>사용자 수동 등록</span>
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
async function readFiles(files: File[]) {
  const XLSX = await import("xlsx");
  const cur: Task[] = [];
  const prev: Task[] = [];
  for (const file of files) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, {
        header: 1,
        raw: false,
        defval: "",
      });
      const tsv = rows
        .map((r) => r.map((c) => String(c).replace(/[\t\n]/g, " ")).join("\t"))
        .join("\n");
      (name.includes("지난주") ? prev : cur).push(...parsePaste(tsv));
    }
  }
  return { cur, prev };
}

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

function tasksToSheetRows(list: Task[], minRows = 8): SheetRow[] {
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

function sheetRowsToTasks(rows: SheetRow[]): Task[] {
  return rows
    .filter((r) => r.some((cell) => cell.trim() !== "") && r[1]?.trim() !== "업무명")
    .filter((r) => r[1]?.trim() || r[0]?.trim())
    .map((c) => ({
      id: uid(),
      code: nextCode(),
      field: FIELDS.includes(c[0].trim() as never) ? c[0].trim() : "복리후생/총무",
      title: c[1].trim() || c[0].trim(),
      owner: c[2].trim() || "미지정",
      due: c[3].trim() || "2026-11-15",
      status: (STATUSES.includes(c[4].trim() as never) ? c[4].trim() : "대기") as Status,
      progress: c[5].trim(),
      issue: c[6].trim(),
    }));
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
  onSubmitRows,
}: {
  title: string;
  subtitle: string;
  rows: SheetRow[];
  setRows: React.Dispatch<React.SetStateAction<SheetRow[]>>;
  onSubmitRows: (tasks: Task[]) => void;
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

  const validTasks = useMemo(() => sheetRowsToTasks(rows), [rows]);
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
          <button
            type="button"
            onClick={() => {
              if (!validTasks.length) return;
              onSubmitRows(validTasks);
              setRows(createEmptySheetRows(8));
            }}
            disabled={validTasks.length === 0}
            className={cn(
              "inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 cursor-pointer",
              validTasks.length === 0 && "opacity-50 pointer-events-none",
            )}
          >
            <span>반영하기 ({validTasks.length}건)</span>
          </button>
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

function UploadView({
  tasks,
  onAdd,
  onNavigate,
}: {
  tasks: Task[];
  onAdd: (t: Task[]) => void;
  onNavigate: (v: ViewId) => void;
}) {
  const [curSheetRows, setCurSheetRows] = useState<SheetRow[]>(() =>
    createEmptySheetRows(8),
  );
  const [prevSheetRows, setPrevSheetRows] = useState<SheetRow[]>(() =>
    createEmptySheetRows(8),
  );

  const run = async (files: File[], forcePrev: boolean) => {
    const { cur, prev } = await readFiles(files);
    const all = forcePrev ? [...cur, ...prev] : [...cur, ...prev];
    if (all.length) {
      onAdd(all);
      // 파일 업로드 시 하단 엑셀표(Jexcel 시트)에도 함께 채워주어 바로 확인 가능하도록 연동
      if (forcePrev) {
        setPrevSheetRows((existing) => {
          const nonEmpty = existing.filter((r) => r.some((c) => c.trim() !== ""));
          return tasksToSheetRows([...sheetRowsToTasks(nonEmpty), ...all], 8);
        });
      } else {
        if (cur.length) {
          setCurSheetRows((existing) => {
            const nonEmpty = existing.filter((r) => r.some((c) => c.trim() !== ""));
            return tasksToSheetRows([...sheetRowsToTasks(nonEmpty), ...cur], 8);
          });
        }
        if (prev.length) {
          setPrevSheetRows((existing) => {
            const nonEmpty = existing.filter((r) => r.some((c) => c.trim() !== ""));
            return tasksToSheetRows([...sheetRowsToTasks(nonEmpty), ...prev], 8);
          });
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">1. 자료 올리기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            위쪽에는 팀원별 업무일지 문서를 여러 개 드래그앤드롭하고, 아래쪽 Jexcel 엑셀표에는 엑셀 내용을 바로 붙여넣거나 직접 입력할 수 있습니다.
          </p>
        </div>
        <button onClick={() => onNavigate("kanban")} className={btnOutline}>
          <span>칸반 보드로 이동 ({tasks.length}건)</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>
          🔒 데이터는 외부 서버로 무단 전송되지 않으며 브라우저 및 지정된 Supabase 워크스페이스에서 안전하게 처리됩니다.
        </span>
      </div>

      {/* 상단: 업무일지 / 지난주 보고서 문서 드래그앤드롭 (다중 파일 누적 등록 지원) */}
      <div className="grid gap-4 md:grid-cols-2">
        <DropZone
          title="이번 주 업무일지 (팀원별 파일 여러 개 가능)"
          hint="「지난주」 이름의 시트가 함께 있으면 지난주 보고서로 읽습니다"
          onFiles={(f) => run(f, false)}
        />
        <DropZone
          title="지난주 보고서"
          hint="엑셀(.xlsx, .xls) 또는 CSV 파일"
          onFiles={(f) => run(f, true)}
        />
      </div>

      {/* 하단: Jexcel 스타일 인터랙티브 엑셀표 (위: 업무일지 문서 / 아래: 엑셀표 구조) */}
      <div className="grid gap-4 xl:grid-cols-2">
        <JexcelSheet
          title="이번 주 업무일지 엑셀표 (직접 입력 / 엑셀 붙여넣기)"
          subtitle="열 순서: A분야 · B업무명 · C담당자 · D기한 · E상태 · F추진현황 · G이슈 (엑셀에서 복사 후 셀에 Ctrl+V)"
          rows={curSheetRows}
          setRows={setCurSheetRows}
          onSubmitRows={onAdd}
        />
        <JexcelSheet
          title="지난주 보고서 엑셀표 (직접 입력 / 엑셀 붙여넣기)"
          subtitle="열 순서: A분야 · B업무명 · C담당자 · D기한 · E상태 · F추진현황 · G이슈 (엑셀에서 복사 후 셀에 Ctrl+V)"
          rows={prevSheetRows}
          setRows={setPrevSheetRows}
          onSubmitRows={onAdd}
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. KANBAN BOARD VIEW
 * ============================================================================ */
function KanbanView({
  tasks,
  setTasks,
  notify,
  onOpenNewTask,
  onSyncTask,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  notify: (m: string) => void;
  onOpenNewTask: () => void;
  onSyncTask: (t: Task) => Promise<void>;
}) {
  const [over, setOver] = useState<Status | null>(null);
  const [selectedField, setSelectedField] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");

  const onDrop = async (e: DragEvent, s: Status) => {
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
    setOver(null);
    notify(`상태가 '${s}'(으)로 변경되었습니다.`);
    if (changed) await onSyncTask(changed);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesField = selectedField === "전체" || t.field === selectedField;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.owner.toLowerCase().includes(q) ||
        t.progress.toLowerCase().includes(q);
      return matchesField && matchesSearch;
    });
  }, [tasks, selectedField, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">2. 진행상태 (칸반 보드)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            카드를 끌어서 상태를 변경하세요.
          </p>
        </div>
        <button className={btnPrimary} onClick={onOpenNewTask}>
          + 새 업무 등록
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["전체", ...FIELDS].map((fd) => (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const list = filteredTasks.filter((t) => t.status === s);
          return (
            <div
              key={s}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => onDrop(e, s)}
              className={cn(
                "min-h-[440px] rounded-xl border-2 p-3.5 transition-colors",
                over === s
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-muted/40",
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
                {list.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className="group cursor-grab rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-all duration-200 hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          fieldColor[t.field] ?? "bg-primary/10 text-primary",
                        )}
                      >
                        {t.field}
                      </span>
                      <button
                        onClick={async () => {
                          setTasks((prev) => prev.filter((item) => item.id !== t.id));
                          notify("업무가 삭제되었습니다.");
                          try {
                            await supabase.from("tasks").delete().eq("id", t.id);
                          } catch {
                            // ignore
                          }
                        }}
                        aria-label="업무 삭제"
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-2.5 text-sm font-bold leading-snug">{t.title}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      👤 {t.owner} · 📅 {t.due}
                    </p>
                    {t.progress && (
                      <p className="mt-2 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground/90">
                        {t.progress}
                      </p>
                    )}
                    {t.issue && (
                      <span className="mt-2 inline-block rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        ⚠ {t.issue}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. WEEKLY REPORT VIEW (주간업무보고서)
 * ============================================================================ */
function ReportView({ tasks, notify }: { tasks: Task[]; notify: (m: string) => void }) {
  const cnt = (s: Status) => tasks.filter((t) => t.status === s).length;
  const delayed = tasks.filter((t) => t.status === "지연 / 이슈");
  const done = (l: Task[]) => l.filter((t) => t.status === "완료" || t.status === "진행 중");
  const next = (l: Task[]) => l.filter((t) => t.status !== "완료");

  const copy = async () => {
    let s = `주간업무보고서\n\nⅠ. 전체 요약\n총 ${tasks.length}건 (완료 ${cnt("완료")} / 진행 중 ${cnt("진행 중")} / 대기 ${cnt("대기")} / 지연 ${cnt("지연 / 이슈")})\n\nⅡ. 분야별 실적\n`;
    FIELDS.forEach((fd) => {
      const l = tasks.filter((t) => t.field === fd);
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
      delayed.map((t) => `  - ${t.title} (${t.owner}): ${t.issue || t.progress}`).join("\n") ||
      "  - 없음"
    }`;
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
          <h2 className="text-2xl font-bold tracking-tight">주간업무보고서</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            등록된 업무 데이터를 기반으로 자동 생성된 부서 주간업무보고서입니다.
          </p>
        </div>
        <button className={btnPrimary} onClick={copy}>
          <Copy className="h-4 w-4" />
          <span>📋 보고서 텍스트 복사</span>
        </button>
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
              {FIELDS.map((fd) => {
                const l = tasks.filter((t) => t.field === fd);
                return (
                  <tr
                    key={fd}
                    className="border-b border-border last:border-b-0 align-top transition-colors hover:bg-muted/20"
                  >
                    <td className="w-40 border-r border-border px-4 py-3.5 font-semibold">
                      {fd}
                    </td>
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
                  ⚠ {t.title}{" "}
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
    </ZenithCard>
  );
}

/* ============================================================================
 * 5. ADMIN USER MANUAL REGISTRATION VIEW (관리자 직접 수동 등록)
 * ============================================================================ */
function AdminUserManagementView({
  users,
  setUsers,
  currentUser,
  dbTableReady,
  notify,
  onActivity,
}: {
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  currentUser: AppUser;
  dbTableReady: boolean;
  notify: (m: string) => void;
  onActivity: (title: string, description: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<string>("복리후생/총무");
  const [role, setRole] = useState<UserRole>("팀원");
  const [submitting, setSubmitting] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const handleManualRegister = async (e: FormEvent) => {
    e.preventDefault();
    const cleanId = username.trim();
    const cleanName = name.trim();
    const cleanEmail = email.trim() || (cleanId ? `${cleanId}@zenith.kr` : "");
    const cleanPw = password.trim();

    if (!cleanId || !cleanName) {
      return notify("아이디와 성명을 입력해주세요.");
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
      return notify("이미 등록된 아이디 또는 이메일입니다.");
    }

    setSubmitting(true);
    try {
      // 1. Supabase Auth 계정 생성 (비밀번호는 Auth 에만 저장)
      const { data: signUpData, error: signUpErr } =
        await supabaseAdminRegistrar.auth.signUp({
          email: cleanEmail,
          password: cleanPw,
          options: {
            data: { username: cleanId, name: cleanName, department, role },
          },
        });
      if (signUpErr || !signUpData.user) {
        return notify(`계정 생성 실패: ${signUpErr?.message ?? "알 수 없는 오류"}`);
      }

      // 2. app_users 프로필/권한 등록 (RLS: 관리자만 가능)
      const { data: inserted, error: insertErr } = await supabase
        .from("app_users")
        .insert({
          auth_user_id: signUpData.user.id,
          username: cleanId,
          email: cleanEmail,
          name: cleanName,
          department,
          role,
          is_active: true,
          created_by: currentUser.username,
        })
        .select()
        .single();
      if (insertErr || !inserted) {
        return notify(`사용자 등록 실패: ${insertErr?.message ?? "알 수 없는 오류"}`);
      }

      setUsers((prev) => [...prev, mapAppUserRow(inserted)]);
      onActivity(
        "신규 사용자 수동 등록 완료",
        `${cleanName} (${cleanId} · ${department} · ${role}) 계정이 발급되었습니다.`,
      );
      setUsername("");
      setEmail("");
      setPassword("");
      setName("");
      notify(`'${cleanName}' (${cleanId}) 계정이 수동 등록되었습니다.`);
    } finally {
      setSubmitting(false);
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_INIT_SQL);
      notify("Supabase 초기 SQL 스키마가 클립보드에 복사되었습니다.");
    } catch {
      notify("SQL 복사에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            4. 사용자 수동 등록 관리 (관리자 전용)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            자체 회원가입이 비활성화되어 있으며, 관리자가 팀원 계정을 직접 수동 등록하고 권한을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSql(!showSql)} className={btnOutline}>
            <Database className="h-4 w-4 text-primary" />
            <span>{showSql ? "Supabase 연동 정보 닫기" : "Supabase DB / CLI 설정 보기"}</span>
          </button>
        </div>
      </div>

      {/* Supabase Connection Info & SQL Schema Box */}
      {showSql && (
        <ZenithCard className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span>Supabase 프로젝트 연동 설정 ({SUPABASE_PROJECT_REF})</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                URL: {SUPABASE_URL} · 마이그레이션 파일:{" "}
                <code>supabase/migrations/20261104000000_init_workboard.sql</code>
              </p>
            </div>
            <button onClick={copySql} className={btnPrimary}>
              <Copy className="h-3.5 w-3.5" />
              <span>📋 Supabase SQL 스키마 복사</span>
            </button>
          </div>
          <pre className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px] text-foreground">
            {SUPABASE_INIT_SQL}
          </pre>
        </ZenithCard>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Manual Registration Form (Left 4 cols) */}
        <ZenithCard className="col-span-full xl:col-span-4 p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">신규 사용자 수동 등록</h2>
              <p className="text-xs text-muted-foreground">
                Supabase Auth 및 내부 계정 레지스트리 동시 발급
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

            <div>
              <label className="mb-1.5 block text-xs font-medium">
                이메일 (비워두면 @zenith.kr 자동 생성)
              </label>
              <input
                type="email"
                className={inputCls}
                placeholder="예: honggd@zenith.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                <label className="mb-1.5 block text-xs font-medium">담당 분야 / 부서</label>
                <select
                  className={inputCls}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="총무기획팀">총무기획팀</option>
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
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
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={cn(btnPrimary, "w-full mt-2", submitting && "opacity-70")}
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? "Supabase 계정 등록 중..." : "+ 계정 수동 등록"}</span>
            </button>
          </form>
        </ZenithCard>

        {/* Registered Users Table (Right 8 cols) */}
        <ZenithCard className="col-span-full xl:col-span-8 p-6">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-semibold">
                등록된 사용자 계정 목록 ({users.length}명)
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                수동 등록된 계정으로 즉시 로그인할 수 있으며, 활성 상태를 제어할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    사용자
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    아이디
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    담당 분야
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    권한
                  </th>
                  <th className="pb-3 text-start text-xs font-medium text-muted-foreground">
                    상태
                  </th>
                  <th className="pb-3 text-end text-xs font-medium text-muted-foreground">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="py-3.5 pr-3">
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
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="font-semibold text-foreground">{u.username}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="text-xs font-medium">{u.department}</span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          u.role === "관리자"
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <button
                        onClick={async () => {
                          if (u.username === "admin") {
                            return notify("기본 관리자 계정은 비활성화할 수 없습니다.");
                          }
                          const nextActive = !u.is_active;
                          setUsers((prev) =>
                            prev.map((item) =>
                              item.id === u.id ? { ...item, is_active: nextActive } : item,
                            ),
                          );
                          notify(
                            `${u.name} 계정이 ${nextActive ? "활성화" : "비활성화"}되었습니다.`,
                          );
                          try {
                            await supabase
                              .from("app_users")
                              .update({ is_active: nextActive })
                              .eq("username", u.username);
                          } catch {
                            // ignore
                          }
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
                    <td className="py-3.5 text-end">
                      {u.username !== "admin" && (
                        <button
                          onClick={async () => {
                            setUsers((prev) => prev.filter((item) => item.id !== u.id));
                            notify(`${u.name} 계정이 삭제되었습니다.`);
                            try {
                              await supabase
                                .from("app_users")
                                .delete()
                                .eq("username", u.username);
                            } catch {
                              // ignore
                            }
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
              </tbody>
            </table>
          </div>
        </ZenithCard>
      </div>
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
    { id: "users" as ViewId, label: "4. 사용자 수동 등록 (관리자)", icon: Users },
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
              Zenith 대시보드 스타일을 맞춤 설정하세요.
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
