import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "@/App";

describe("App (Zenith Dashboard + Weekly Workboard)", () => {
  it("renders the Zenith dashboard overview directly on initial load", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "대시보드 (Dashboard)" })).toBeInTheDocument();
    expect(screen.getByText("최근 업무 현황 (Recent Tasks)")).toBeInTheDocument();
    expect(screen.getByText("동계 콘도 추첨 시스템 오픈")).toBeInTheDocument();
  });

  it("navigates between Upload, Kanban, Report, and Login screens", () => {
    render(<App />);

    fireEvent.click(screen.getAllByText("2. 진행상태 (칸반 보드)")[0]!);
    expect(screen.getByText("카드를 끌어서 상태를 변경하세요.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("3. 주간업무보고서")[0]!);
    expect(screen.getByText("Ⅰ. 전체 요약")).toBeInTheDocument();

    fireEvent.click(screen.getByText("로그아웃"));
    expect(screen.getByText("업무관리 시스템 로그인")).toBeInTheDocument();
  });
});
