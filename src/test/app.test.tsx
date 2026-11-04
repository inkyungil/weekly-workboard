import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "@/App";

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
    expect(
      screen.getByText("이번 주 업무일지 (팀원별 파일 여러 개 가능)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("이번 주 업무일지 엑셀표 (직접 입력 / 엑셀 붙여넣기)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("지난주 보고서 엑셀표 (직접 입력 / 엑셀 붙여넣기)"),
    ).toBeInTheDocument();

    // Fill sample rows in Jexcel sheet and reflect
    fireEvent.click(screen.getAllByText("샘플 채우기")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "반영하기 (2건)" }));

    // Navigate to Admin Manual User Registration view
    fireEvent.click(screen.getAllByText("4. 사용자 수동 등록")[0]!);
    expect(
      screen.getByRole("heading", { name: "4. 사용자 수동 등록 관리 (관리자 전용)" }),
    ).toBeInTheDocument();

    // Register a new user manually
    fireEvent.change(screen.getByPlaceholderText("예: honggd"), {
      target: { value: "honggd" },
    });
    fireEvent.change(screen.getByPlaceholderText("예: 홍길동"), {
      target: { value: "홍길동" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ 계정 수동 등록" }));

    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeInTheDocument();
    });
  });
});
