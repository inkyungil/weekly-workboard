import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "@/App";

describe("App (Supabase Auth + Admin Manual Registration + Zenith Dashboard)", () => {
  it("renders the login screen first with admin-only registration policy", () => {
    render(<App />);

    expect(screen.getByText("업무관리 시스템 로그인")).toBeInTheDocument();
    expect(screen.getByText("회원가입 안내 (관리자 수동 등록 전용)")).toBeInTheDocument();
  });

  it("logs in as admin, manually registers a user, and navigates across Zenith views", async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("admin 또는 admin@zenith.kr"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "대시보드 (Dashboard)" })).toBeInTheDocument();
    });

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
