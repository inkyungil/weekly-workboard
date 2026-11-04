// 업로드 자료 규칙 기반 분석 (AI 미사용)
//  - 머리글로 열 찾기 · 날짜 정규화 · 상태 추정 · 마감 초과 · 기존 업무 매칭 · 지난주 대비 변화

export const STATUSES = ["대기", "진행 중", "지연 / 이슈", "완료"] as const;
export type Status = (typeof STATUSES)[number];

export type TaskLike = {
  id: string;
  code?: string;
  field: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  progress: string;
  issue: string;
  updated_at?: string;
};

export const DRAFT_KEYS = [
  "field",
  "title",
  "owner",
  "due",
  "status",
  "progress",
  "issue",
] as const;
export type DraftKey = (typeof DRAFT_KEYS)[number];
export type Draft = Record<DraftKey, string>;

/* ---------------------------------------------------------- 열 찾기 */

// 머리글 별칭 (공백 제거 · 소문자 비교)
const COLUMN_ALIASES: Record<DraftKey, string[]> = {
  field: ["분야", "업무분야", "담당분야", "구분", "부서", "파트"],
  title: ["업무명", "업무", "과제", "과제명", "업무내용", "제목", "항목"],
  owner: ["담당자", "담당", "작성자", "성명", "이름"],
  due: ["기한", "마감", "마감일", "마감기한", "완료예정일", "예정일", "일정", "기한일"],
  status: ["상태", "진행상태", "진행단계", "현황구분"],
  progress: ["추진현황", "진행현황", "진행내용", "추진내용", "금주실적", "실적", "진척", "비고"],
  issue: ["이슈", "문제", "이슈사항", "애로사항", "문제점", "리스크"],
};

const normHeader = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// 머리글 행이면 열 위치를, 아니면 null (업무명 열은 반드시 있어야 함)
// 업무일지 양식 머리글 — 자료 올리기에서 그대로 인식되는 이름
export const TEMPLATE_HEADERS: Record<DraftKey, string> = {
  field: "분야",
  title: "업무명",
  owner: "담당자",
  due: "기한",
  status: "상태",
  progress: "추진현황",
  issue: "이슈",
};

export function detectColumns(header: string[]): Partial<Record<DraftKey, number>> | null {
  const cells = header.map((h) => normHeader(String(h ?? "")));
  const mapping: Partial<Record<DraftKey, number>> = {};
  const used = new Set<number>();
  // 정확히 일치하는 별칭을 먼저, 그다음 포함 관계로
  for (const exact of [true, false]) {
    for (const key of DRAFT_KEYS) {
      if (mapping[key] !== undefined) continue;
      const idx = cells.findIndex(
        (c, i) =>
          c !== "" &&
          !used.has(i) &&
          COLUMN_ALIASES[key].some((a) => (exact ? c === a : c.includes(a))),
      );
      if (idx >= 0) {
        mapping[key] = idx;
        used.add(idx);
      }
    }
  }
  return mapping.title !== undefined && Object.keys(mapping).length >= 2 ? mapping : null;
}

// 고정 열 순서: 분야 · 업무명 · 담당자 · 기한 · 상태 · 추진현황 · 이슈
const POSITIONAL: Record<DraftKey, number> = {
  field: 0,
  title: 1,
  owner: 2,
  due: 3,
  status: 4,
  progress: 5,
  issue: 6,
};

export type ParsedRows = {
  drafts: Draft[];
  headerDetected: boolean;
  mapping: Partial<Record<DraftKey, number>>;
};

// 표(2차원 배열)를 업무 초안으로 — 앞쪽 5행 안에서 머리글을 찾고, 없으면 고정 열 순서로 읽음
export function rowsToDrafts(rows: string[][]): ParsedRows {
  const clean = rows.map((r) => r.map((c) => String(c ?? "").trim()));
  let headerAt = -1;
  let mapping: Partial<Record<DraftKey, number>> = POSITIONAL;
  for (let i = 0; i < Math.min(5, clean.length); i++) {
    const found = detectColumns(clean[i]!);
    if (found) {
      headerAt = i;
      mapping = found;
      break;
    }
  }
  const body = headerAt >= 0 ? clean.slice(headerAt + 1) : clean;
  const drafts = body
    .map((r) => {
      const d = {} as Draft;
      for (const key of DRAFT_KEYS) {
        const idx = mapping[key];
        d[key] = idx === undefined ? "" : (r[idx] ?? "");
      }
      d.due = normalizeDate(d.due);
      return d;
    })
    .filter((d) => d.title !== "" && d.title !== "업무명");
  return { drafts, headerDetected: headerAt >= 0, mapping };
}

/* ---------------------------------------------------------- 날짜 */

const pad = (n: number) => String(n).padStart(2, "0");

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 2026.11.5 · 2026/11/05 · 2026년 11월 5일 · 11/5/26(엑셀 표시형) → 2026-11-05, 그 외는 그대로
export function normalizeDate(raw: string, now: Date = new Date()): string {
  const s = raw.trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\.?$/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
  }
  m = s.match(/^(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\.?$/);
  if (m) return `${now.getFullYear()}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
  return s;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 완료되지 않았고 기한(YYYY-MM-DD)이 오늘보다 이전
export function isOverdue(t: { due: string; status: string }, today: string = todayIso()): boolean {
  return t.status !== "완료" && ISO_DATE.test(t.due) && t.due < today;
}

/* ---------------------------------------------------------- 상태 추정 */

// 위에서부터 먼저 맞는 규칙을 씀 — 부정/미완 표현을 완료보다 먼저 확인
const STATUS_RULES: { status: Status; words: string[] }[] = [
  {
    status: "지연 / 이슈",
    words: ["지연", "차질", "보류", "중단", "미달", "불가", "문제 발생", "오류", "장애"],
  },
  {
    status: "진행 중",
    words: [
      "미완료",
      "미완",
      "조치 중",
      "조치중",
      "진행 중",
      "진행중",
      "검토 중",
      "검토중",
      "작성 중",
      "작성중",
      "협의 중",
      "협의중",
      "준비 중",
      "준비중",
      "추진 중",
      "추진중",
      "%",
    ],
  },
  { status: "완료", words: ["완료", "종료", "마감함", "마침", "끝남", "완수", "제출함", "배포함"] },
  { status: "대기", words: ["예정", "대기", "착수 전", "미착수", "계획"] },
];

export function inferStatus(progress: string, issue: string): Status | null {
  const text = `${progress} ${issue}`;
  if (!text.trim()) return null;
  for (const rule of STATUS_RULES) {
    if (rule.words.some((w) => text.includes(w))) return rule.status;
  }
  return null;
}

/* ---------------------------------------------------------- 행 분석 */

export type StatusSource = "입력" | "추정" | "기본값" | "기존 유지" | "마감 초과";

// 기존 업무와 병합할 때 파일 값으로 바꾸지 않는 칸
export type UploadConflict = {
  field: Exclude<DraftKey, "title">;
  kept: string; // 지킨 값 (시스템)
  incoming: string; // 버린 값 (파일)
};

export type RowAnalysis = {
  draft: Draft; // 파일에서 읽은 값
  final: Draft; // 기존 업무와 병합한 뒤 저장할 값
  status: Status;
  statusSource: StatusSource;
  overdue: boolean;
  matched: TaskLike | null; // 같은 업무명·담당자의 기존 업무
  unknownOwner: boolean; // 회원 명단에 없는 담당자
  keptBlank: number; // 파일이 비어 있어 기존 값을 유지한 칸 수
  conflicts: UploadConflict[]; // 이번 주 시스템에서 고친 값을 지킨 칸
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export const taskKey = (t: { title: string; owner: string }) => `${norm(t.title)}|${norm(t.owner)}`;

const MERGE_KEYS = ["field", "owner", "due", "progress", "issue"] as const;

// 병합 규칙 (기존 업무와 같은 업무명·담당자일 때)
//  - 파일의 빈 칸은 기존 값을 지우지 않음
//  - 기존 업무가 protectSince 이후(이번 주) 시스템에서 수정됐고 값이 다르면 시스템 값을 지키고 충돌로 보고
//    (overwriteConflicts 가 true 면 파일 값으로 덮어씀)
//  - 상태: 파일 값 → 파일 추진현황·이슈 문구로 추정 → 기존 상태 순
export function analyzeDrafts(
  drafts: Draft[],
  opts: {
    existing: TaskLike[];
    memberNames: string[];
    today?: string;
    markOverdue: boolean;
    protectSince?: string; // ISO 시각 — 이 시각 이후 수정된 기존 업무는 보호
    overwriteConflicts?: boolean;
  },
): RowAnalysis[] {
  const today = opts.today ?? todayIso();
  const byKey = new Map(opts.existing.map((t) => [taskKey(t), t]));
  const members = new Set(opts.memberNames.map(norm));
  const protectTime = opts.protectSince ? new Date(opts.protectSince).getTime() : NaN;

  return drafts.map((draft) => {
    const matched = byKey.get(taskKey(draft)) ?? null;
    const updatedTime = matched?.updated_at ? new Date(matched.updated_at).getTime() : NaN;
    const isProtected =
      !opts.overwriteConflicts && !Number.isNaN(protectTime) && updatedTime >= protectTime;

    const final: Draft = { ...draft };
    const conflicts: UploadConflict[] = [];
    let keptBlank = 0;

    if (matched) {
      for (const k of MERGE_KEYS) {
        const incoming = draft[k].trim();
        const existing = (matched[k] ?? "").trim();
        if (!incoming) {
          final[k] = existing;
          if (existing) keptBlank++;
        } else if (incoming !== existing && existing && isProtected) {
          final[k] = existing;
          conflicts.push({ field: k, kept: existing, incoming });
        }
      }
    }

    let status: Status;
    let statusSource: StatusSource;
    const guess = inferStatus(draft.progress, draft.issue);
    if ((STATUSES as readonly string[]).includes(draft.status)) {
      status = draft.status as Status;
      statusSource = "입력";
    } else if (guess) {
      status = guess;
      statusSource = "추정";
    } else if (matched && (STATUSES as readonly string[]).includes(matched.status)) {
      status = matched.status as Status;
      statusSource = "기존 유지";
    } else {
      status = "대기";
      statusSource = "기본값";
    }
    if (matched && isProtected && statusSource !== "기존 유지" && status !== matched.status) {
      conflicts.push({ field: "status", kept: matched.status, incoming: status });
      status = matched.status as Status;
      statusSource = "기존 유지";
    }
    final.status = status;

    const overdue = isOverdue({ due: final.due, status }, today);
    if (overdue && opts.markOverdue && status !== "지연 / 이슈") {
      status = "지연 / 이슈";
      statusSource = "마감 초과";
      final.status = status;
    }
    return {
      draft,
      final,
      status,
      statusSource,
      overdue,
      matched,
      unknownOwner: final.owner !== "" && members.size > 0 && !members.has(norm(final.owner)),
      keptBlank,
      conflicts,
    };
  });
}

// 분석 결과를 저장할 업무로 — 기존 업무와 맞으면 그 id·코드를 이어받아 갱신, 아니면 새 업무
export function analysisToTasks<T extends TaskLike>(
  rows: RowAnalysis[],
  make: (base: TaskLike | null) => { id: string; code: string },
): T[] {
  return rows.map((r) => {
    const { id, code } = r.matched ? { id: r.matched.id, code: r.matched.code ?? "" } : make(null);
    return {
      id,
      code,
      field: r.final.field,
      title: r.final.title,
      owner: r.final.owner || "미지정",
      due: r.final.due,
      status: r.status,
      progress: r.final.progress,
      issue: r.final.issue,
    } as T;
  });
}

/* ---------------------------------------------------------- 지난주 대비 */

export type WeekComparison = {
  added: TaskLike[]; // 이번 주에 새로 생긴 업무
  completed: TaskLike[]; // 지난주 미완료 → 이번 주 완료
  carried: TaskLike[]; // 지난주에 이어 계속 진행 (미완료)
  statusChanged: { task: TaskLike; from: string; to: string }[]; // 이월 업무 중 상태가 바뀐 것
  stalled: TaskLike[]; // 이월 업무 중 추진현황이 지난주와 같은 것
  dropped: TaskLike[]; // 지난주 미완료였는데 이번 주 목록에 없는 업무
};

export function compareWeeks(prev: TaskLike[], cur: TaskLike[]): WeekComparison {
  const prevByKey = new Map(prev.map((t) => [taskKey(t), t]));
  const curKeys = new Set(cur.map(taskKey));
  const out: WeekComparison = {
    added: [],
    completed: [],
    carried: [],
    statusChanged: [],
    stalled: [],
    dropped: [],
  };

  for (const t of cur) {
    const before = prevByKey.get(taskKey(t));
    if (!before) {
      out.added.push(t);
      continue;
    }
    if (before.status === "완료") continue; // 지난주에 이미 끝난 업무
    if (t.status === "완료") {
      out.completed.push(t);
      continue;
    }
    out.carried.push(t);
    if (before.status !== t.status)
      out.statusChanged.push({ task: t, from: before.status, to: t.status });
    if (norm(before.progress) === norm(t.progress)) out.stalled.push(t);
  }
  out.dropped = prev.filter((t) => t.status !== "완료" && !curKeys.has(taskKey(t)));
  return out;
}

// 분야 목록: 기본 분야 순서를 앞에 두고, 업무에 있는 나머지 분야를 이어 붙임 (빈 분야는 "미분류")
export function fieldsOf(tasks: { field: string }[], preferred: readonly string[] = []): string[] {
  const present = new Set(tasks.map((t) => t.field.trim() || "미분류"));
  const ordered = preferred.filter((f) => present.has(f));
  const rest = [...present]
    .filter((f) => !preferred.includes(f))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}
