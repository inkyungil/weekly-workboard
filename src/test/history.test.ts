import { describe, expect, it } from "vitest";

import {
  addMonths,
  changedInWeek,
  monthTimeline,
  stateAsOf,
  weekOrdinalLabel,
  weeksOfMonth,
  type WeeklyState,
} from "@/lib/history";

const row = (
  task_id: string,
  week_start: string,
  status: string,
  over: Partial<WeeklyState> = {},
): WeeklyState => ({
  task_id,
  week_start,
  code: "",
  field: "자산",
  title: task_id,
  owner: "김철수",
  due: "",
  status,
  progress: "",
  issue: "",
  deleted: false,
  ...over,
});

// A: 11/02 진행 중 → 11/16 지연 → 11/23 완료
// B: 10/26 대기 (이후 변경 없음)
// C: 11/09 신규 → 11/16 삭제
const rows = [
  row("A", "2026-11-02", "진행 중"),
  row("A", "2026-11-16", "지연 / 이슈"),
  row("A", "2026-11-23", "완료"),
  row("B", "2026-10-26", "대기"),
  row("C", "2026-11-09", "진행 중"),
  row("C", "2026-11-16", "진행 중", { deleted: true }),
];

describe("주 기준 상태", () => {
  it("그 주까지의 마지막 기록을 쓰고, 변경 없는 업무는 이전 상태가 이어진다", () => {
    const at = (w: string) =>
      Object.fromEntries(stateAsOf(rows, w).map((s) => [s.task_id, s.status]));
    expect(at("2026-10-26")).toEqual({ B: "대기" });
    expect(at("2026-11-09")).toEqual({ A: "진행 중", B: "대기", C: "진행 중" });
    expect(at("2026-11-16")).toEqual({ A: "지연 / 이슈", B: "대기" }); // C 삭제
    expect(at("2026-11-30")).toEqual({ A: "완료", B: "대기" });
  });

  it("그 주에 갱신된 업무만 표시", () => {
    expect([...changedInWeek(rows, "2026-11-16")]).toEqual(["A"]);
    expect([...changedInWeek(rows, "2026-11-30")]).toEqual([]);
  });
});

describe("월 · 주차", () => {
  it("월에 걸친 주 목록", () => {
    expect(weeksOfMonth("2026-11")).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("몇째 주 표시 (목요일이 속한 달 기준)", () => {
    expect(weekOrdinalLabel("2026-11-02")).toBe("11월 1주");
    expect(weekOrdinalLabel("2026-11-30")).toBe("12월 1주");
    expect(weekOrdinalLabel("2026-10-26")).toBe("10월 5주");
  });
});

describe("월간 타임라인", () => {
  const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];

  it("주차별 상태 흐름과 월 집계", () => {
    const items = monthTimeline(rows, weeks);
    const a = items.find((i) => i.state.task_id === "A")!;
    expect(a.trail).toEqual(["진행 중", "진행 중", "지연 / 이슈", "완료", "완료"]);
    expect(a).toMatchObject({
      createdThisMonth: true,
      completedThisMonth: true,
      delayedThisMonth: true,
    });

    const b = items.find((i) => i.state.task_id === "B")!;
    expect(b.trail).toEqual(["대기", "대기", "대기", "대기", "대기"]);
    expect(b).toMatchObject({
      createdThisMonth: false,
      completedThisMonth: false,
      delayedThisMonth: false,
    });

    expect(items.map((i) => i.state.task_id).sort()).toEqual(["A", "B"]); // 월말에 삭제된 C 제외
  });

  it("진행 중인 달은 기준 주까지만", () => {
    const items = monthTimeline(rows, weeks, "2026-11-09");
    expect(items.find((i) => i.state.task_id === "A")!.trail).toEqual(["진행 중", "진행 중"]);
    expect(items.some((i) => i.state.task_id === "C")).toBe(true);
  });
});
