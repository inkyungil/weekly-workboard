import * as XLSX from "xlsx";
import { expect, it } from "vitest";
import { DRAFT_KEYS, TEMPLATE_HEADERS, rowsToDrafts } from "@/lib/analysis";
it("양식 머리글로 만든 엑셀을 다시 올리면 그대로 읽힌다", () => {
  const header = DRAFT_KEYS.map((k) => TEMPLATE_HEADERS[k]);
  const ws = XLSX.utils.aoa_to_sheet([
    header,
    ["자산", "실사", "김철수", "2026.11.5", "", "조치 중", ""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "업무일지");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const back = XLSX.read(buf);
  const rows = XLSX.utils.sheet_to_json<string[]>(back.Sheets["업무일지"]!, {
    header: 1,
    raw: false,
    defval: "",
  });
  const r = rowsToDrafts(rows);
  expect(r.headerDetected).toBe(true);
  expect(r.drafts).toEqual([
    {
      field: "자산",
      title: "실사",
      owner: "김철수",
      due: "2026-11-05",
      status: "",
      progress: "조치 중",
      issue: "",
    },
  ]);
});
