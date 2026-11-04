import { createFileRoute } from "@tanstack/react-router";
import { useState, type DragEvent, type ReactNode } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "업무관리 시스템 | 주간업무보고 · 칸반" },
      { name: "description", content: "주간업무보고 자동 생성 및 칸반 보드 관리 시스템" },
      { property: "og:title", content: "업무관리 시스템" },
      { property: "og:description", content: "주간업무보고 자동 생성 및 칸반 보드 관리 시스템" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const FIELDS = ["복리후생/총무", "사회공헌/의전", "자산", "비상계획"] as const;
const STATUSES = ["대기", "진행 중", "지연 / 이슈", "완료"] as const;
type Status = (typeof STATUSES)[number];
type Task = { id: string; field: string; title: string; owner: string; due: string; status: Status; progress: string; issue: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const SAMPLE: Task[] = [
  { id: uid(), field: "복리후생/총무", title: "동계 콘도 추첨 시스템 오픈", owner: "김철수", due: "2026-11-04", status: "지연 / 이슈", progress: "인증 오류 조치 중", issue: "외부 연동 지연" },
  { id: uid(), field: "복리후생/총무", title: "4분기 건강검진 안내", owner: "이영희", due: "2026-11-04", status: "완료", progress: "전사 안내 완료", issue: "" },
  { id: uid(), field: "사회공헌/의전", title: "연말 연탄나눔 기획", owner: "박민수", due: "2026-11-10", status: "진행 중", progress: "수혜 가구 선정 중", issue: "" },
  { id: uid(), field: "자산", title: "하반기 고정자산 실사", owner: "최동석", due: "2026-11-05", status: "완료", progress: "1차 바코드 실사 완료", issue: "" },
  { id: uid(), field: "비상계획", title: "동절기 소방시설 점검", owner: "정대리", due: "2026-11-12", status: "대기", progress: "체크리스트 작성 완료", issue: "" },
];

const fieldColor: Record<string, string> = {
  "복리후생/총무": "bg-primary/10 text-primary",
  "사회공헌/의전": "bg-success/15 text-success",
  자산: "bg-warning/20 text-foreground",
  비상계획: "bg-destructive/10 text-destructive",
};
const statusColor: Record<Status, string> = {
  대기: "bg-muted text-muted-foreground",
  "진행 중": "bg-primary/10 text-primary",
  "지연 / 이슈": "bg-destructive/10 text-destructive",
  완료: "bg-success/15 text-success",
};

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const btn = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors";
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const btnOutline = `${btn} border border-input bg-background hover:bg-accent`;
const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>{children}</div>
);

function parsePaste(text: string): Task[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t|,|\|/).map((c) => c.trim()))
    .filter((c) => c.length >= 2 && c[1] !== "업무명")
    .map((c) => ({
      id: uid(),
      field: FIELDS.includes(c[0] as never) ? (c[0] as string) : "복리후생/총무",
      title: c[1] ?? "",
      owner: c[2] ?? "",
      due: c[3] ?? "",
      status: (STATUSES.includes(c[4] as never) ? c[4] : "대기") as Status,
      progress: c[5] ?? "",
      issue: c[6] ?? "",
    }));
}

function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(SAMPLE);
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState("");
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="min-h-screen bg-muted/40 font-sans">
      {!isLoggedIn ? (
        <Login onLogin={() => setIsLoggedIn(true)} />
      ) : (
        <>
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <h1 className="text-lg font-bold">업무관리 시스템</h1>
              <div className="flex items-center gap-3 text-sm">
                <span><b>관리자</b> 님 환영합니다</span>
                <button className={btnOutline} onClick={() => setIsLoggedIn(false)}>로그아웃</button>
              </div>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 px-6">
              {["1. 자료 올리기", "2. 진행상태 (칸반 보드)", "3. 주간업무보고서"].map((t, i) => (
                <button key={t} onClick={() => setTab(i)}
                  className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </nav>
          </header>
          <main className="mx-auto max-w-7xl p-6">
            {tab === 0 && <Upload onAdd={(n) => { setTasks((p) => [...p, ...n]); notify(`${n.length}건이 반영되었습니다.`); }} />}
            {tab === 1 && <Kanban tasks={tasks} setTasks={setTasks} notify={notify} />}
            {tab === 2 && <Report tasks={tasks} notify={notify} />}
          </main>
        </>
      )}
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg">{toast}</div>}
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pw) return setErr("아이디와 비밀번호를 입력해주세요.");
    if (id !== "admin" || pw !== "1234") return setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    onLogin();
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-bold">업무관리 시스템 로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">주간업무보고 및 칸반 관리 시스템입니다.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div><label className="mb-1 block text-sm font-medium">아이디(이메일)</label><input className={inputCls} value={id} onChange={(e) => setId(e.target.value)} placeholder="admin" /></div>
          <div><label className="mb-1 block text-sm font-medium">비밀번호</label><input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••" /></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button className={`${btnPrimary} w-full`}>로그인</button>
          <p className="rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">테스트 계정: admin / 1234</p>
        </form>
      </Card>
    </div>
  );
}

async function readFiles(files: File[]) {
  const XLSX = await import("xlsx");
  const cur: Task[] = [];
  const prev: Task[] = [];
  for (const file of files) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" });
      const tsv = rows.map((r) => r.map((c) => String(c).replace(/[\t\n]/g, " ")).join("\t")).join("\n");
      (name.includes("지난주") ? prev : cur).push(...parsePaste(tsv));
    }
  }
  return { cur, prev };
}

function DropZone({ title, hint, onFiles }: { title: string; hint: string; onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const handle = (list: FileList | null) => {
    const f = Array.from(list ?? []).filter((x) => /\.(xlsx|xls|csv)$/i.test(x.name));
    if (!f.length) return;
    setNames(f.map((x) => x.name));
    onFiles(f);
  };
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={`mt-3 flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted"}`}>
        <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
        <span className="text-3xl">📂</span>
        <p className="mt-2 text-sm font-medium">업무일지 파일을 끌어다 놓거나 눌러서 고르세요</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </label>
      {names.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{names.map((n) => <li key={n}>📄 {n}</li>)}</ul>}
    </Card>
  );
}

function Upload({ onAdd }: { onAdd: (t: Task[]) => void }) {
  const run = async (files: File[], forcePrev: boolean) => {
    const { cur, prev } = await readFiles(files);
    const all = forcePrev ? [...cur, ...prev] : [...cur, ...prev];
    if (all.length) onAdd(all);
  };
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">🔒 데이터는 외부 서버로 전송되지 않고 브라우저 내에서만 안전하게 처리됩니다.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <DropZone title="이번 주 업무일지 (팀원별 파일 여러 개 가능)" hint="「지난주」 이름의 시트가 함께 있으면 지난주 보고서로 읽습니다" onFiles={(f) => run(f, false)} />
        <DropZone title="지난주 보고서" hint="엑셀(.xlsx, .xls) 또는 CSV 파일" onFiles={(f) => run(f, true)} />
      </div>
      <p className="text-xs text-muted-foreground">열 순서: 분야 · 업무명 · 담당자 · 기한 · 상태 · 추진현황 · 이슈</p>
    </div>
  );
}

function Kanban({ tasks, setTasks, notify }: { tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>>; notify: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState<Status | null>(null);
  const empty = { field: FIELDS[0] as string, title: "", owner: "", due: "", status: "대기" as Status, progress: "", issue: "" };
  const [f, setF] = useState(empty);
  const onDrop = (e: DragEvent, s: Status) => {
    const id = e.dataTransfer.getData("text/plain");
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, status: s } : t)));
    setOver(null);
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">카드를 끌어서 상태를 변경하세요.</p>
        <button className={btnPrimary} onClick={() => setOpen(true)}>+ 새 업무 등록</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const list = tasks.filter((t) => t.status === s);
          return (
            <div key={s} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)} onDrop={(e) => onDrop(e, s)}
              className={`min-h-[400px] rounded-xl border-2 p-3 transition-colors ${over === s ? "border-primary bg-primary/5" : "border-transparent bg-muted"}`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[s]}`}>{s}</span>
                <span className="text-xs text-muted-foreground">{list.length}건</span>
              </div>
              <div className="space-y-2">
                {list.map((t) => (
                  <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className="cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${fieldColor[t.field]}`}>{t.field}</span>
                    <p className="mt-2 font-bold">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">👤 {t.owner} · 📅 {t.due}</p>
                    {t.progress && <p className="mt-1 text-xs">{t.progress}</p>}
                    {t.issue && <span className="mt-2 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">⚠ {t.issue}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()} className="space-y-3">
              <h2 className="text-lg font-bold">새 업무 등록</h2>
              <input className={inputCls} placeholder="업무명" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })}>{FIELDS.map((x) => <option key={x}>{x}</option>)}</select>
                <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
                <input className={inputCls} placeholder="담당자" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
                <input type="date" className={inputCls} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="추진현황" value={f.progress} onChange={(e) => setF({ ...f, progress: e.target.value })} />
              <input className={inputCls} placeholder="이슈 (없으면 비워두세요)" value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} />
              <div className="flex justify-end gap-2 pt-2">
                <button className={btnOutline} onClick={() => setOpen(false)}>취소</button>
                <button className={btnPrimary} onClick={() => {
                  if (!f.title.trim()) return notify("업무명을 입력해주세요.");
                  setTasks((p) => [...p, { ...f, id: uid() }]); setF(empty); setOpen(false); notify("새 업무가 등록되었습니다.");
                }}>등록</button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Report({ tasks, notify }: { tasks: Task[]; notify: (m: string) => void }) {
  const cnt = (s: Status) => tasks.filter((t) => t.status === s).length;
  const delayed = tasks.filter((t) => t.status === "지연 / 이슈");
  const done = (l: Task[]) => l.filter((t) => t.status === "완료" || t.status === "진행 중");
  const next = (l: Task[]) => l.filter((t) => t.status !== "완료");

  const copy = async () => {
    let s = `주간업무보고서\n\nⅠ. 전체 요약\n총 ${tasks.length}건 (완료 ${cnt("완료")} / 진행 중 ${cnt("진행 중")} / 대기 ${cnt("대기")} / 지연 ${cnt("지연 / 이슈")})\n\nⅡ. 분야별 실적\n`;
    FIELDS.forEach((fd) => {
      const l = tasks.filter((t) => t.field === fd);
      s += `\n[${fd}]\n 금주 실적:\n${done(l).map((t) => `  - ${t.title} (${t.owner}): ${t.progress}`).join("\n") || "  - 없음"}\n 차주 계획:\n${next(l).map((t) => `  - ${t.title} (~${t.due})`).join("\n") || "  - 없음"}\n`;
    });
    s += `\nⅢ. 주요 이슈 및 지연 업무\n${delayed.map((t) => `  - ${t.title} (${t.owner}): ${t.issue || t.progress}`).join("\n") || "  - 없음"}`;
    try { await navigator.clipboard.writeText(s); notify("보고서 텍스트가 클립보드에 복사되었습니다."); } catch { notify("복사에 실패했습니다."); }
  };

  return (
    <Card className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-2xl font-bold">주간업무보고서</h2>
        <button className={btnPrimary} onClick={copy}>📋 보고서 텍스트 복사</button>
      </div>
      <section>
        <h3 className="mb-3 text-lg font-bold">Ⅰ. 전체 요약</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-foreground px-3 py-1 font-semibold text-background">총 {tasks.length}건</span>
          {STATUSES.map((s) => <span key={s} className={`rounded-full px-3 py-1 font-semibold ${statusColor[s]}`}>{s} {cnt(s)}건</span>)}
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold">Ⅱ. 분야별 실적</h3>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-muted">{["분야", "금주 실적", "차주 계획"].map((h) => <th key={h} className="border border-border p-2 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {FIELDS.map((fd) => {
              const l = tasks.filter((t) => t.field === fd);
              return (
                <tr key={fd} className="align-top">
                  <td className="w-36 border border-border p-2 font-semibold">{fd}</td>
                  <td className="border border-border p-2">{done(l).length ? done(l).map((t) => <div key={t.id}>• {t.title} ({t.owner}) – {t.progress}</div>) : <span className="text-muted-foreground">없음</span>}</td>
                  <td className="border border-border p-2">{next(l).length ? next(l).map((t) => <div key={t.id}>• {t.title} (~{t.due})</div>) : <span className="text-muted-foreground">없음</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold">Ⅲ. 주요 이슈 및 지연 업무</h3>
        {delayed.length ? delayed.map((t) => (
          <div key={t.id} className="mb-2 rounded-lg border-l-4 border-destructive bg-destructive/10 p-4">
            <p className="font-bold text-destructive">⚠ {t.title} <span className="font-normal">({t.field} · {t.owner} · {t.due})</span></p>
            <p className="mt-1 text-sm">이슈: {t.issue || "-"} / 추진현황: {t.progress}</p>
          </div>
        )) : <p className="text-sm text-muted-foreground">지연 업무가 없습니다.</p>}
      </section>
    </Card>
  );
}
