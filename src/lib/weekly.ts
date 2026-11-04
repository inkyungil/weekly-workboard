// 주차 계산 · 제출 현황 · 배포/취합 병합 규칙 (화면과 분리된 순수 로직)

import { descendantIds, flattenDepartments, type AppUser, type Department } from "./supabase";

export type WeeklyTask = {
  id: string;
  code: string;
  field: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  progress: string;
  issue: string;
  updated_at?: string;
};

/* ---------------------------------------------------------------- 주차 */

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

// 해당 날짜가 속한 주의 월요일 (YYYY-MM-DD, 현지 시간 기준)
export function weekStartOf(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7; // 월=0 … 일=6
  d.setDate(d.getDate() - offset);
  return toIso(d);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = fromIso(weekStart);
  d.setDate(d.getDate() + n * 7);
  return toIso(d);
}

// "2026-11-02 ~ 11-08"
export function weekLabel(weekStart: string): string {
  const end = fromIso(weekStart);
  end.setDate(end.getDate() + 6);
  return `${weekStart} ~ ${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

// 타임스탬프가 [월요일 00:00, 다음 월요일 00:00) 안에 있는지 (현지 시간)
export function isInWeek(timestamp: string | undefined, weekStart: string): boolean {
  if (!timestamp) return false;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return false;
  const start = fromIso(weekStart).getTime();
  const end = fromIso(addWeeks(weekStart, 1)).getTime();
  return t >= start && t < end;
}

/* ----------------------------------------------------------- 제출 현황 */

export type MemberSubmission = {
  member: AppUser;
  taskCount: number; // 담당 업무 수
  updatedCount: number; // 이번 주에 갱신한 담당 업무 수
  submitted: boolean;
};

export type DepartmentSubmission = {
  department: Department | null; // null = 소속 없음
  depth: number;
  members: MemberSubmission[];
  submittedCount: number;
  rate: number; // 0~100
};

// 활성 회원별로 "이번 주에 본인 담당 업무를 1건 이상 갱신했는지" 집계 (담당자는 이름으로 매칭)
export function buildSubmissionStatus(
  users: AppUser[],
  tasks: WeeklyTask[],
  departments: Department[],
  weekStart: string,
): DepartmentSubmission[] {
  const byMember = (u: AppUser): MemberSubmission => {
    const own = tasks.filter((t) => t.owner.trim() === u.name.trim());
    const updated = own.filter((t) => isInWeek(t.updated_at, weekStart));
    return {
      member: u,
      taskCount: own.length,
      updatedCount: updated.length,
      submitted: updated.length > 0,
    };
  };
  const summarize = (
    department: Department | null,
    depth: number,
    members: AppUser[],
  ): DepartmentSubmission => {
    const list = members.map(byMember);
    const submittedCount = list.filter((m) => m.submitted).length;
    return {
      department,
      depth,
      members: list,
      submittedCount,
      rate: list.length ? Math.round((submittedCount / list.length) * 100) : 0,
    };
  };

  const active = users.filter((u) => u.is_active);
  const known = new Set(departments.map((d) => d.id));
  const rows = flattenDepartments(departments).map(({ dept, depth }) =>
    summarize(
      dept,
      depth,
      active.filter((u) => u.department_id === dept.id),
    ),
  );
  const unassigned = active.filter((u) => !u.department_id || !known.has(u.department_id));
  if (unassigned.length) rows.push(summarize(null, 0, unassigned));
  return rows;
}

// 미제출자 독촉 문구
export function reminderText(rows: DepartmentSubmission[], weekStart: string): string {
  const pending = rows
    .map((r) => ({
      name: r.department?.name ?? "소속 없음",
      members: r.members.filter((m) => !m.submitted).map((m) => m.member.name),
    }))
    .filter((r) => r.members.length > 0);
  if (pending.length === 0)
    return `[주간업무 ${weekLabel(weekStart)}] 모든 회원이 업무를 갱신했습니다.`;
  return [
    `[주간업무 입력 요청] ${weekLabel(weekStart)}`,
    "아래 분들은 이번 주 담당 업무 진행상황이 아직 갱신되지 않았습니다.",
    "금주 실적 · 차주 계획 · 이슈를 입력 부탁드립니다.",
    "",
    ...pending.map((r) => `- ${r.name}: ${r.members.join(", ")}`),
  ].join("\n");
}

/* ------------------------------------------------------- 배포 · 취합 */

// 배포 파일의 열 순서 — 취합 시 이 머리글로 읽음
export const DIST_COLUMNS = [
  { key: "id", header: "ID(수정 금지)" },
  { key: "code", header: "업무코드" },
  { key: "field", header: "분야" },
  { key: "title", header: "업무명" },
  { key: "owner", header: "담당자" },
  { key: "due", header: "마감일" },
  { key: "status", header: "상태" },
  { key: "progress", header: "추진현황" },
  { key: "issue", header: "이슈" },
  { key: "updated_at", header: "배포 기준시각(수정 금지)" },
] as const;

export const MERGE_FIELDS = [
  "field",
  "title",
  "owner",
  "due",
  "status",
  "progress",
  "issue",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

export const FIELD_LABELS: Record<MergeField, string> = {
  field: "분야",
  title: "업무명",
  owner: "담당자",
  due: "마감일",
  status: "상태",
  progress: "추진현황",
  issue: "이슈",
};

export type DistRow = Partial<Record<(typeof DIST_COLUMNS)[number]["key"], string>>;

// 조직(하위 조직 포함) 소속 회원이 담당자인 업무만
export function tasksForDepartment<T extends WeeklyTask>(
  tasks: T[],
  users: AppUser[],
  departments: Department[],
  departmentId: string,
): T[] {
  const ids = descendantIds(departments, departmentId);
  const names = new Set(
    users.filter((u) => u.department_id && ids.has(u.department_id)).map((u) => u.name.trim()),
  );
  return tasks.filter((t) => names.has(t.owner.trim()));
}

export function toDistRows(tasks: WeeklyTask[]): DistRow[] {
  return tasks.map((t) => ({
    id: t.id,
    code: t.code,
    field: t.field,
    title: t.title,
    owner: t.owner,
    due: t.due,
    status: t.status,
    progress: t.progress,
    issue: t.issue,
    updated_at: t.updated_at ?? "",
  }));
}

// 엑셀 시트 행(머리글 → 값)을 배포 행으로 변환
export function parseDistSheet(records: Record<string, unknown>[]): DistRow[] {
  return records
    .map((rec) => {
      const row: DistRow = {};
      for (const col of DIST_COLUMNS) {
        const v = rec[col.header];
        if (v !== undefined && v !== null) row[col.key] = String(v).trim();
      }
      return row;
    })
    .filter((r) => Object.values(r).some((v) => v));
}

export type MergeConflict = {
  taskId: string;
  title: string;
  field: MergeField;
  kept: string; // 지킨 값 (DB)
  incoming: string; // 버린 값 (파일)
};

export type MergeResult = {
  updated: WeeklyTask[]; // 바뀐 기존 업무 (병합 후 전체 행)
  created: WeeklyTask[]; // 파일에서 새로 추가된 업무
  filled: number; // 빈 칸 → 파일 값으로 채운 칸 수
  changed: number; // 파일 값으로 덮어쓴 칸 수
  conflicts: MergeConflict[]; // 배포 후 DB 에서도 바뀌어 DB 값을 지킨 칸
  unknownIds: string[]; // 파일에 있으나 DB 에 없는 ID (삭제된 업무)
  invalidStatus: number; // 상태 값이 올바르지 않아 무시한 칸 수
};

// 병합 규칙
//  - 파일의 빈 칸은 무시 (기존 값을 지우지 않음)
//  - DB 칸이 비어 있으면 파일 값으로 채움
//  - 둘 다 값이 있고 다르면: 배포 이후 DB 가 수정됐으면(DB updated_at > 배포 기준시각) DB 값을 지키고 충돌로 보고,
//    아니면 파일 값으로 덮어씀
//  - ID 없는 행은 업무명이 있으면 새 업무로 추가
export function mergeDistRows(
  current: WeeklyTask[],
  rows: DistRow[],
  opts: { statuses: readonly string[]; newId: () => string; newCode: () => string },
): MergeResult {
  const byId = new Map(current.map((t) => [t.id, t]));
  const result: MergeResult = {
    updated: [],
    created: [],
    filled: 0,
    changed: 0,
    conflicts: [],
    unknownIds: [],
    invalidStatus: 0,
  };

  for (const row of rows) {
    const id = row.id?.trim();
    if (!id) {
      if (!row.title) continue;
      const status =
        row.status && opts.statuses.includes(row.status) ? row.status : opts.statuses[0]!;
      if (row.status && status !== row.status) result.invalidStatus++;
      result.created.push({
        id: opts.newId(),
        code: row.code || opts.newCode(),
        field: row.field ?? "",
        title: row.title,
        owner: row.owner ?? "",
        due: row.due ?? "",
        status,
        progress: row.progress ?? "",
        issue: row.issue ?? "",
      });
      continue;
    }

    const base = byId.get(id);
    if (!base) {
      result.unknownIds.push(id);
      continue;
    }

    const baseTime = row.updated_at ? new Date(row.updated_at).getTime() : NaN;
    const dbTime = base.updated_at ? new Date(base.updated_at).getTime() : NaN;
    // 배포 기준시각을 알 수 없으면 보수적으로 "DB 가 수정됨" 으로 봄
    const dbChangedSinceDist =
      Number.isNaN(baseTime) || (!Number.isNaN(dbTime) && dbTime > baseTime);

    const next: WeeklyTask = { ...base };
    let touched = false;
    for (const f of MERGE_FIELDS) {
      const incoming = row[f]?.trim() ?? "";
      const existing = (base[f] ?? "").trim();
      if (!incoming || incoming === existing) continue;
      if (f === "status" && !opts.statuses.includes(incoming)) {
        result.invalidStatus++;
        continue;
      }
      if (!existing) {
        next[f] = incoming;
        result.filled++;
        touched = true;
      } else if (dbChangedSinceDist) {
        result.conflicts.push({
          taskId: id,
          title: base.title,
          field: f,
          kept: existing,
          incoming,
        });
      } else {
        next[f] = incoming;
        result.changed++;
        touched = true;
      }
    }
    if (touched) result.updated.push(next);
  }
  return result;
}
