import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "@/App";

describe("App", () => {
  it("renders the login screen", () => {
    render(<App />);

    expect(screen.getByText("업무관리 시스템 로그인")).toBeInTheDocument();
  });
});
