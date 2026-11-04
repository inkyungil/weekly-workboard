import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";

// 실제 Supabase 대신 쓰는 테스트용 클라이언트 — 세션 없음, 로그인 성공, 조회 결과 비어 있음, insert 는 받은 행을 그대로 반환
vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>();

  const queryBuilder = () => {
    let inserted: Record<string, unknown> | null = null;
    const result = () =>
      inserted
        ? { data: { id: "usr-new", created_at: "2026-11-04", ...inserted }, error: null }
        : { data: [], error: null };
    const builder: Record<string, unknown> = {
      insert: (row: Record<string, unknown>) => {
        inserted = row;
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    for (const m of [
      "select",
      "order",
      "eq",
      "update",
      "upsert",
      "delete",
      "single",
      "maybeSingle",
    ]) {
      builder[m] = () => builder;
    }
    return builder;
  };

  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: "auth-admin" } }, error: null })),
    signUp: vi.fn(async () => ({ data: { user: { id: "auth-new" } }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };

  return {
    ...actual,
    supabase: { auth, from: vi.fn(() => queryBuilder()) },
    supabaseAdminRegistrar: { auth },
    fetchProfile: vi.fn(async () => actual.INITIAL_USERS[0]),
  };
});

describe("App (Supabase Auth + Admin Manual Registration + Zenith Jexcel Workboard)", () => {
  it("renders the login screen first with Zenith 주간업무 보고서 branding and admin-only registration policy", async () => {
    render(<App />);

    expect(await screen.findByText("주간업무 보고서")).toBeInTheDocument();
    expect(screen.getByText("업무관리 시스템 로그인")).toBeInTheDocument();
    expect(screen.getByText("회원가입 안내 (관리자 수동 등록 전용)")).toBeInTheDocument();
  });

  it("redirects a logged-out visit to a page URL to /login", async () => {
    window.history.pushState({}, "", "/kanban");
    render(<App />);

    expect(await screen.findByText("업무관리 시스템 로그인")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("logs in as admin, checks Jexcel sheets in Upload view, and registers a user manually", async () => {
    render(<App />);

    fireEvent.change(await screen.findByPlaceholderText("예: admin"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "대시보드 (Dashboard)" })).toBeInTheDocument();
    });

    // Navigate to 1. 자료 올리기 (Top DropZones + Bottom Jexcel Sheets)
    fireEvent.click(screen.getAllByText("1. 자료 올리기")[0]!);
    expect(screen.getByText("이번 주 업무일지 (팀원별 파일 여러 개 가능)")).toBeInTheDocument();
    expect(
      screen.getByText("이번 주 업무일지 엑셀표 (직접 입력 / 엑셀 붙여넣기)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("지난주 보고서 엑셀표 (직접 입력 / 엑셀 붙여넣기)"),
    ).toBeInTheDocument();

    // Fill sample rows in Jexcel sheet and reflect
    fireEvent.click(screen.getAllByText("샘플 채우기")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "반영하기 (2건)" }));

    // 계정관리 · 직급 관리에서 직급 추가
    fireEvent.click(screen.getAllByText("직급 관리")[0]!);
    expect(window.location.pathname).toBe("/accounts/positions");
    fireEvent.change(screen.getByPlaceholderText("예: 과장"), { target: { value: "과장" } });
    fireEvent.click(screen.getByRole("button", { name: "직급 추가" }));
    expect(await screen.findByRole("button", { name: "과장 직급 삭제" })).toBeInTheDocument();

    // 계정관리 · 조직도 관리에서 조직 추가
    fireEvent.click(screen.getAllByText("조직도 관리")[0]!);
    expect(window.location.pathname).toBe("/accounts/org");
    fireEvent.change(screen.getByPlaceholderText("예: 인사팀"), { target: { value: "인사팀" } });
    fireEvent.click(screen.getByRole("button", { name: "조직 추가" }));
    expect(await screen.findByRole("button", { name: "인사팀 조직 삭제" })).toBeInTheDocument();

    // 계정관리 · 회원 관리에서 소속·직급을 지정해 회원 등록
    fireEvent.click(screen.getAllByText("회원 관리")[0]!);
    expect(window.location.pathname).toBe("/accounts/members");
    expect(screen.getByRole("heading", { name: "회원 관리" })).toBeInTheDocument();

    // Register a new user manually
    fireEvent.change(screen.getByPlaceholderText("예: honggd"), {
      target: { value: "honggd" },
    });
    fireEvent.change(screen.getByPlaceholderText("예: 홍길동"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByPlaceholderText("8자 이상"), {
      target: { value: "honggd1234!" },
    });
    fireEvent.change(screen.getByLabelText("소속 조직"), { target: { value: "usr-new" } });
    fireEvent.click(screen.getByRole("button", { name: "+ 회원 등록" }));

    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeInTheDocument();
    });
  });
});
