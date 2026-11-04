import { describe, expect, it } from "vitest";

import type { AppUser, Department } from "@/lib/supabase";
import {
  addWeeks,
  buildSubmissionStatus,
  isInWeek,
  mergeDistRows,
  parseDistSheet,
  reminderText,
  tasksForDepartment,
  toDistRows,
  weekLabel,
  weekStartOf,
  type WeeklyTask,
} from "@/lib/weekly";

const STATUSES = ["대기", "진행 중", "지연 / 이슈", "완료"] as const;

const user = (
  id: string,
  name: string,
  department_id: string | null,
  is_active = true,
): AppUser => ({
  id,
  username: id,
  email: `${id}@zenith.kr`,
  name,
  department: "",
  department_id,
  role: "팀원",
  is_active,
  created_by: "admin",
  created_at: "2026-11-01",
});

const task = (over: Partial<WeeklyTask>): WeeklyTask => ({
  id: "t-1",
  code: "TSK-1",
  field: "자산",
  title: "실사",
  owner: "김철수",
  due: "2026-11-05",
  status: "진행 중",
  progress: "",
  issue: "",
  updated_at: "2026-11-03T09:00:00",
  ...over,
});

const depts: Department[] = [
  { id: "root", name: "총무기획팀", parent_id: null, sort_order: 0 },
  { id: "a", name: "자산파트", parent_id: "root", sort_order: 1 },
  { id: "b", name: "의전파트", parent_id: "root", sort_order: 2 },
];

describe("주차 계산", () => {
  it("월요일 시작 주를 구한다 (일요일은 직전 월요일)", () => {
    expect(weekStartOf(new Date(2026, 10, 4))).toBe("2026-11-02"); // 수
    expect(weekStartOf(new Date(2026, 10, 2))).toBe("2026-11-02"); // 월
    expect(weekStartOf(new Date(2026, 10, 8))).toBe("2026-11-02"); // 일
    expect(weekStartOf(new Date(2026, 10, 9))).toBe("2026-11-09"); // 다음 월
  });

  it("주 이동과 표시", () => {
    expect(addWeeks("2026-11-02", 1)).toBe("2026-11-09");
    expect(addWeeks("2026-01-05", -1)).toBe("2025-12-29");
    expect(weekLabel("2026-11-02")).toBe("2026-11-02 ~ 11-08");
  });

  it("주 범위는 월요일 0시 포함, 다음 월요일 0시 제외", () => {
    expect(isInWeek("2026-11-02T00:00:00", "2026-11-02")).toBe(true);
    expect(isInWeek("2026-11-08T23:59:59", "2026-11-02")).toBe(true);
    expect(isInWeek("2026-11-09T00:00:00", "2026-11-02")).toBe(false);
    expect(isInWeek(undefined, "2026-11-02")).toBe(false);
    expect(isInWeek("not-a-date", "2026-11-02")).toBe(false);
  });
});

describe("제출 현황", () => {
  const users = [
    user("u1", "김철수", "a"),
    user("u2", "이영희", "a"),
    user("u3", "박민수", "b"),
    user("u4", "최동석", null),
    user("u5", "퇴사자", "a", false),
  ];
  const tasks = [
    task({ id: "t1", owner: "김철수", updated_at: "2026-11-03T10:00:00" }),
    task({ id: "t2", owner: "이영희", updated_at: "2026-10-28T10:00:00" }), // 지난주
    task({ id: "t3", owner: "최동석", updated_at: "2026-11-04T10:00:00" }),
  ];

  it("조직별로 이번 주 갱신 여부와 입력률을 집계한다 (비활성 제외, 소속 없음 별도)", () => {
    const rows = buildSubmissionStatus(users, tasks, depts, "2026-11-02");
    const byName = Object.fromEntries(rows.map((r) => [r.department?.name ?? "소속 없음", r]));

    expect(byName["총무기획팀"]!.members).toHaveLength(0);
    expect(byName["자산파트"]!.members.map((m) => [m.member.name, m.submitted])).toEqual([
      ["김철수", true],
      ["이영희", false],
    ]);
    expect(byName["자산파트"]!.rate).toBe(50);
    expect(byName["의전파트"]!.rate).toBe(0);
    expect(byName["소속 없음"]!.submittedCount).toBe(1);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
  });

  it("미제출자 독촉 문구", () => {
    const text = reminderText(
      buildSubmissionStatus(users, tasks, depts, "2026-11-02"),
      "2026-11-02",
    );
    expect(text).toContain("2026-11-02 ~ 11-08");
    expect(text).toContain("- 자산파트: 이영희");
    expect(text).toContain("- 의전파트: 박민수");
    expect(text).not.toContain("김철수");
    expect(text).not.toContain("퇴사자");
  });

  it("모두 제출하면 완료 문구", () => {
    const rows = buildSubmissionStatus([users[0]!], tasks, depts, "2026-11-02");
    expect(reminderText(rows, "2026-11-02")).toContain("모든 회원이");
  });
});

describe("배포 · 취합", () => {
  const opts = { statuses: STATUSES, newId: () => "new-1", newCode: () => "TSK-9" };

  it("하위 조직 회원의 업무까지 배포 대상에 포함한다", () => {
    const users = [user("u1", "김철수", "a"), user("u3", "박민수", "b")];
    const tasks = [task({ id: "t1", owner: "김철수" }), task({ id: "t2", owner: "박민수" })];
    expect(tasksForDepartment(tasks, users, depts, "a").map((t) => t.id)).toEqual(["t1"]);
    expect(tasksForDepartment(tasks, users, depts, "root").map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("배포 파일 머리글로 다시 읽는다", () => {
    const rows = parseDistSheet([
      { "ID(수정 금지)": "t1", 업무명: " 실사 ", 상태: "완료", "배포 기준시각(수정 금지)": "x" },
      { "ID(수정 금지)": "", 업무명: "" },
    ]);
    expect(rows).toEqual([{ id: "t1", title: "실사", status: "완료", updated_at: "x" }]);
  });

  it("빈 칸은 채우고, 배포 후 DB 가 안 바뀌었으면 파일 값으로 덮어쓴다", () => {
    const current = [task({ id: "t1", progress: "", status: "진행 중" })];
    const [row] = toDistRows(current);
    const r = mergeDistRows(current, [{ ...row!, progress: "1차 완료", status: "완료" }], opts);
    expect(r.filled).toBe(1);
    expect(r.changed).toBe(1);
    expect(r.conflicts).toHaveLength(0);
    expect(r.updated[0]).toMatchObject({ progress: "1차 완료", status: "완료" });
  });

  it("배포 후 DB 도 바뀐 칸은 DB 값을 지키고 충돌로 보고한다 (빈 칸 채우기는 그대로)", () => {
    const distributed = task({
      id: "t1",
      status: "진행 중",
      issue: "",
      updated_at: "2026-11-03T09:00:00",
    });
    const [row] = toDistRows([distributed]);
    const current = [{ ...distributed, status: "지연 / 이슈", updated_at: "2026-11-04T09:00:00" }];

    const r = mergeDistRows(current, [{ ...row!, status: "완료", issue: "부품 지연" }], opts);
    expect(r.conflicts).toEqual([
      { taskId: "t1", title: "실사", field: "status", kept: "지연 / 이슈", incoming: "완료" },
    ]);
    expect(r.filled).toBe(1);
    expect(r.updated[0]).toMatchObject({ status: "지연 / 이슈", issue: "부품 지연" });
  });

  it("파일의 빈 칸은 기존 값을 지우지 않고, 같은 값은 변경으로 세지 않는다", () => {
    const current = [task({ id: "t1", progress: "진행 중" })];
    const [row] = toDistRows(current);
    const r = mergeDistRows(current, [{ ...row!, progress: "" }], opts);
    expect(r.updated).toHaveLength(0);
    expect(r.filled + r.changed).toBe(0);
  });

  it("ID 없는 행은 새 업무, 없는 ID 는 따로 보고, 잘못된 상태는 무시한다", () => {
    const current = [task({ id: "t1" })];
    const r = mergeDistRows(
      current,
      [
        { title: "신규 업무", owner: "김철수", status: "엉뚱함" },
        { id: "gone", title: "삭제된 업무" },
        { id: "t1", status: "엉뚱함", updated_at: current[0]!.updated_at! },
      ],
      opts,
    );
    expect(r.created).toEqual([
      expect.objectContaining({ id: "new-1", code: "TSK-9", title: "신규 업무", status: "대기" }),
    ]);
    expect(r.unknownIds).toEqual(["gone"]);
    expect(r.invalidStatus).toBe(2);
    expect(r.updated).toHaveLength(0);
  });

  it("배포 기준시각이 없으면 다른 값은 덮어쓰지 않고 충돌로 본다", () => {
    const current = [task({ id: "t1", status: "진행 중" })];
    const r = mergeDistRows(current, [{ id: "t1", status: "완료" }], opts);
    expect(r.conflicts).toHaveLength(1);
    expect(r.updated).toHaveLength(0);
  });
});
