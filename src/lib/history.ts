// 칸반 주간/월간 조회 — task_weekly_states 기록으로 특정 주·월의 보드를 다시 구성

import { addWeeks, weekStartOf } from "./weekly";

export type WeeklyState = {
  task_id: string;
  week_start: string; // YYYY-MM-DD (월요일)
  code: string;
  field: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  progress: string;
  issue: string;
  deleted: boolean;
};

// 주차까지의 마지막 기록 = 그 주 말 기준 상태 (삭제된 업무 제외)
export function stateAsOf(rows: WeeklyState[], week: string): WeeklyState[] {
  const latest = new Map<string, WeeklyState>();
  for (const r of rows) {
    if (r.week_start > week) continue;
    const cur = latest.get(r.task_id);
    if (!cur || r.week_start > cur.week_start) latest.set(r.task_id, r);
  }
  return [...latest.values()].filter((r) => !r.deleted);
}

// 그 주에 실제로 기록(추가·수정)이 있었던 업무 id
export function changedInWeek(rows: WeeklyState[], week: string): Set<string> {
  return new Set(rows.filter((r) => r.week_start === week && !r.deleted).map((r) => r.task_id));
}

const pad = (n: number) => String(n).padStart(2, "0");

export const monthOf = (date: Date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return monthOf(d);
}

// 월에 걸친 주(월요일)들 — 1일이 속한 주부터 말일이 속한 주까지
export function weeksOfMonth(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const first = weekStartOf(new Date(y!, m! - 1, 1));
  const last = weekStartOf(new Date(y!, m!, 0));
  const weeks: string[] = [];
  for (let w = first; w <= last; w = addWeeks(w, 1)) weeks.push(w);
  return weeks;
}

// 그 주가 몇째 주인지 (월요일이 속한 달 기준): "11월 1주"
export function weekOrdinalLabel(week: string): string {
  const [y, m, d] = week.split("-").map(Number);
  const monday = new Date(y!, m! - 1, d!);
  // 그 주의 목요일이 속한 달을 기준 달로 (ISO 주차 관례)
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const firstOfMonth = new Date(thursday.getFullYear(), thursday.getMonth(), 1);
  const firstThursday = new Date(firstOfMonth);
  firstThursday.setDate(1 + ((4 - firstOfMonth.getDay() + 7) % 7));
  const nth = Math.floor((thursday.getDate() - firstThursday.getDate()) / 7) + 1;
  return `${thursday.getMonth() + 1}월 ${nth}주`;
}

export type MonthTimelineItem = {
  state: WeeklyState; // 월 마지막 주(또는 기준 주) 기준 상태
  trail: (string | null)[]; // 주차별 상태 (그 주에 아직 없던 업무는 null)
  createdThisMonth: boolean; // 첫 기록이 이 달 안
  completedThisMonth: boolean; // 이 달 중 '완료'로 바뀜
  delayedThisMonth: boolean; // 이 달 중 한 번이라도 '지연 / 이슈'
};

export function monthTimeline(
  rows: WeeklyState[],
  weeks: string[],
  untilWeek: string = weeks[weeks.length - 1]!,
): MonthTimelineItem[] {
  const shownWeeks = weeks.filter((w) => w <= untilWeek);
  if (shownWeeks.length === 0) return [];
  const firstWeek = shownWeeks[0]!;
  const final = stateAsOf(rows, shownWeeks[shownWeeks.length - 1]!);
  const firstSeen = new Map<string, string>();
  for (const r of rows) {
    const cur = firstSeen.get(r.task_id);
    if (!cur || r.week_start < cur) firstSeen.set(r.task_id, r.week_start);
  }
  const perWeek = shownWeeks.map(
    (w) => new Map(stateAsOf(rows, w).map((s) => [s.task_id, s.status])),
  );
  const before = new Map(
    stateAsOf(rows, addWeeks(firstWeek, -1)).map((s) => [s.task_id, s.status]),
  );

  return final.map((state) => {
    const trail = perWeek.map((m) => m.get(state.task_id) ?? null);
    const seen = firstSeen.get(state.task_id) ?? state.week_start;
    return {
      state,
      trail,
      createdThisMonth: seen >= firstWeek,
      completedThisMonth: state.status === "완료" && before.get(state.task_id) !== "완료",
      delayedThisMonth: trail.includes("지연 / 이슈"),
    };
  });
}
