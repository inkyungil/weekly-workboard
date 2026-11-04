import { describe, expect, it } from "vitest";

import {
  analysisToTasks,
  analyzeDrafts,
  compareWeeks,
  DRAFT_KEYS,
  TEMPLATE_HEADERS,
  detectColumns,
  fieldsOf,
  inferStatus,
  isOverdue,
  normalizeDate,
  rowsToDrafts,
  type Draft,
  type TaskLike,
} from "@/lib/analysis";

const draft = (over: Partial<Draft>): Draft => ({
  field: "자산",
  title: "실사",
  owner: "김철수",
  due: "2026-11-10",
  status: "",
  progress: "",
  issue: "",
  ...over,
});

const task = (over: Partial<TaskLike>): TaskLike => ({
  id: "t1",
  code: "TSK-1",
  field: "자산",
  title: "실사",
  owner: "김철수",
  due: "2026-11-10",
  status: "진행 중",
  progress: "",
  issue: "",
  ...over,
});

describe("열 찾기", () => {
  it("머리글 별칭과 순서가 달라도 열을 찾는다", () => {
    expect(detectColumns(["담당자", "업무 명", "마감일", "진행 상태", "금주 실적"])).toEqual({
      owner: 0,
      title: 1,
      due: 2,
      status: 3,
      progress: 4,
    });
  });

  it("양식 엑셀 머리글은 모든 열이 제자리로 인식된다", () => {
    const header = DRAFT_KEYS.map((k) => TEMPLATE_HEADERS[k]);
    expect(detectColumns(header)).toEqual(Object.fromEntries(DRAFT_KEYS.map((k, i) => [k, i])));
  });

  it("업무명 열이 없으면 머리글로 보지 않는다", () => {
    expect(detectColumns(["자산", "실사", "김철수"])).toBeNull();
  });

  it("앞쪽 행에서 머리글을 찾아 읽고, 날짜를 정규화한다", () => {
    const r = rowsToDrafts([
      ["2026년 주간업무", "", ""],
      ["업무", "담당", "기한", "상태"],
      ["콘도 추첨", "김철수", "2026.11.5", "완료"],
      ["", "", "", ""],
    ]);
    expect(r.headerDetected).toBe(true);
    expect(r.drafts).toEqual([
      draft({ field: "", title: "콘도 추첨", owner: "김철수", due: "2026-11-05", status: "완료" }),
    ]);
  });

  it("머리글이 없으면 고정 열 순서로 읽는다", () => {
    const r = rowsToDrafts([["자산", "실사", "김철수", "11/5/26", "진행 중", "50%", ""]]);
    expect(r.headerDetected).toBe(false);
    expect(r.drafts[0]).toMatchObject({ title: "실사", due: "2026-11-05", status: "진행 중" });
  });
});

describe("날짜 · 마감 초과", () => {
  it("여러 날짜 표기를 YYYY-MM-DD 로", () => {
    const now = new Date(2026, 10, 4);
    expect(normalizeDate("2026/11/05", now)).toBe("2026-11-05");
    expect(normalizeDate("2026년 11월 5일", now)).toBe("2026-11-05");
    expect(normalizeDate("11.5", now)).toBe("2026-11-05");
    expect(normalizeDate("미정", now)).toBe("미정");
    expect(normalizeDate("", now)).toBe("");
  });

  it("미완료이고 기한이 오늘 이전이면 마감 초과", () => {
    expect(isOverdue({ due: "2026-11-03", status: "진행 중" }, "2026-11-04")).toBe(true);
    expect(isOverdue({ due: "2026-11-04", status: "진행 중" }, "2026-11-04")).toBe(false);
    expect(isOverdue({ due: "2026-11-03", status: "완료" }, "2026-11-04")).toBe(false);
    expect(isOverdue({ due: "미정", status: "대기" }, "2026-11-04")).toBe(false);
  });
});

describe("상태 추정", () => {
  it("부정·미완 표현을 완료보다 먼저 본다", () => {
    expect(inferStatus("1차 완료, 2차 조치 중", "")).toBe("진행 중");
    expect(inferStatus("미완료", "")).toBe("진행 중");
    expect(inferStatus("완료 예정이었으나 지연", "")).toBe("지연 / 이슈");
    expect(inferStatus("전사 안내 완료", "")).toBe("완료");
    expect(inferStatus("", "외부 연동 문제 발생")).toBe("지연 / 이슈");
    expect(inferStatus("다음 주 착수 예정", "")).toBe("대기");
    expect(inferStatus("자료 정리", "")).toBeNull();
  });
});

describe("행 분석", () => {
  const existing = [task({ id: "old-1", code: "TSK-7", title: " 실사 ", owner: "김철수" })];

  it("상태 출처 · 마감 초과 · 기존 업무 매칭 · 미등록 담당자", () => {
    const rows = analyzeDrafts(
      [
        draft({ status: "완료" }),
        draft({ title: "콘도", progress: "조치 중", due: "2026-11-01" }),
        draft({ title: "검진", owner: "홍길동", due: "" }),
      ],
      { existing, memberNames: ["김철수", "이영희"], today: "2026-11-04", markOverdue: true },
    );
    expect(rows.map((r) => [r.status, r.statusSource, r.overdue])).toEqual([
      ["완료", "입력", false],
      ["지연 / 이슈", "마감 초과", true],
      ["대기", "기본값", false],
    ]);
    expect(rows[0]!.matched?.id).toBe("old-1");
    expect(rows[1]!.matched).toBeNull();
    expect(rows.map((r) => r.unknownOwner)).toEqual([false, false, true]);
  });

  it("마감 초과 반영을 끄면 상태는 그대로 두고 표시만 한다", () => {
    const [r] = analyzeDrafts([draft({ status: "진행 중", due: "2026-11-01" })], {
      existing: [],
      memberNames: [],
      today: "2026-11-04",
      markOverdue: false,
    });
    expect(r).toMatchObject({ status: "진행 중", statusSource: "입력", overdue: true });
  });

  it("기존 업무는 id·코드를 이어받고, 새 업무는 새로 발급한다", () => {
    const rows = analyzeDrafts([draft({ due: "" }), draft({ title: "신규" })], {
      existing,
      memberNames: [],
      today: "2026-11-04",
      markOverdue: true,
    });
    const tasks = analysisToTasks(rows, () => ({ id: "new-1", code: "TSK-9" }));
    expect(tasks[0]).toMatchObject({ id: "old-1", code: "TSK-7", due: "2026-11-10" });
    expect(tasks[1]).toMatchObject({ id: "new-1", code: "TSK-9", title: "신규" });
  });
});

describe("지난주 대비", () => {
  it("신규 · 완료됨 · 이월 · 상태 변화 · 진척 없음 · 사라짐", () => {
    const prev = [
      task({ title: "A", status: "진행 중", progress: "50%" }),
      task({ title: "B", status: "진행 중", progress: "착수" }),
      task({ title: "C", status: "대기", progress: "" }),
      task({ title: "D", status: "진행 중" }),
      task({ title: "E", status: "완료" }),
    ];
    const cur = [
      task({ title: "A", status: "완료", progress: "완료" }),
      task({ title: "B", status: "지연 / 이슈", progress: "착수" }),
      task({ title: "C", status: "진행 중", progress: "자료 수집" }),
      task({ title: "E", status: "완료" }),
      task({ title: "F", status: "대기" }),
    ];
    const c = compareWeeks(prev, cur);
    const titles = (l: TaskLike[]) => l.map((t) => t.title);
    expect(titles(c.added)).toEqual(["F"]);
    expect(titles(c.completed)).toEqual(["A"]);
    expect(titles(c.carried)).toEqual(["B", "C"]);
    expect(c.statusChanged.map((s) => [s.task.title, s.from, s.to])).toEqual([
      ["B", "진행 중", "지연 / 이슈"],
      ["C", "대기", "진행 중"],
    ]);
    expect(titles(c.stalled)).toEqual(["B"]);
    expect(titles(c.dropped)).toEqual(["D"]);
  });

  it("담당자가 다르면 다른 업무로 본다", () => {
    const c = compareWeeks([task({ owner: "김철수" })], [task({ owner: "이영희" })]);
    expect(c.added).toHaveLength(1);
    expect(c.dropped).toHaveLength(1);
  });
});

describe("분야 목록", () => {
  it("기본 분야 순서 + 그 외 분야 + 미분류", () => {
    expect(
      fieldsOf(
        [{ field: "자산" }, { field: "인사" }, { field: "" }, { field: "복리후생/총무" }],
        ["복리후생/총무", "자산", "비상계획"],
      ),
    ).toEqual(["복리후생/총무", "자산", "미분류", "인사"]);
  });
});
