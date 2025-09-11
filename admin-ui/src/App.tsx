import { useEffect, useState } from "react";
import { auth, googleProvider } from "./services/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import Filters from "./components/Filters";
import LeadsTable from "./components/LeadsTable";
import Pager from "./components/Pager";
import { fetchLeads, incrementDownloads } from "./services/leads";
import { useLeads } from "./hooks/useLeads";
import { leadsToCsv } from "./utils/csv";
import type { Lead } from "./types";

const ALLOWED_ADMINS = ["angdry@planplant.io"];

export default function App() {
  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setMe(u?.email ?? null);
    });
    return unsub;
  }, []);

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };
  const logout = async () => {
    await signOut(auth);
  };

  const isAllowed = me && ALLOWED_ADMINS.includes(me);

  const { filters, updateFilters, page, setPage, total, totalPages, pageRows, pageSize, filtered } = useLeads(rows);

  const headerAllCount = filtered.length;
  const onToggleAll = (check: boolean) => {
    const s = new Set(selected);
    if (check) filtered.forEach((r) => s.add(r.id));
    else filtered.forEach((r) => s.delete(r.id));
    setSelected(s);
  };
  const onToggleRow = (id: string, check: boolean) => {
    const s = new Set(selected);
    if (check) s.add(id);
    else s.delete(id);
    setSelected(s);
  };

  const reload = async () => {
    const data = await fetchLeads();
    setRows(data);
    setPage(1);
  };

  useEffect(() => {
    if (isAllowed) reload();
  }, [isAllowed]);

  const downloadCsv = async () => {
    if (selected.size === 0) {
      alert("다운로드할 행이 없습니다.");
      return;
    }
    const chosen = rows.filter((r) => selected.has(r.id));
    const csv = leadsToCsv(chosen);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_selected_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // 카운트 +1
    try {
      await incrementDownloads(chosen.map((r) => r.id));
      const inc = new Set(chosen.map((r) => r.id));
      setRows((prev) => prev.map((r) => (inc.has(r.id) ? { ...r, download: Number(r.download ?? 0) + 1 } : r)));
    } catch (e: any) {
      alert(`다운로드 카운트 업데이트 실패\ncode:${e?.code}\nmsg:${e?.message}`);
    }
  };

  if (!me) {
    return (
      <div style={{ maxWidth: 1200, margin: "20px auto", fontFamily: "system-ui" }}>
        <h2>기획공장 Admin</h2>
        <p>Google 계정으로 로그인하세요.</p>
        <button onClick={login}>Google 로그인</button>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className='container'>
        <h2>기획공장 Admin</h2>
        <p>접근 권한이 없습니다. ({me})</p>
        <button onClick={logout}>로그아웃</button>
      </div>
    );
  }

  return (
    <div className='container'>
      <header className='header'>
        <h1 className='h1'>기획공장 Admin</h1>
        <span className='sub'>Leads 관리 · 최신순</span>
        <div style={{ flex: 1 }} />
        <button className='btn' onClick={logout}>
          로그아웃
        </button>
      </header>
      <section className='card'>
        <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>표시는 최신순 / CSV는 선택 행만 / 전체선택은 현재 필터 결과 전체</div>
        <Filters value={filters} onChange={updateFilters} onReload={reload} onDownload={downloadCsv} className='toolbar' />
        <div className='table-wrap'>
          <LeadsTable rows={pageRows} selected={selected} onToggleRow={onToggleRow} onToggleAll={onToggleAll} allCount={headerAllCount} className='table' />
        </div>
        <Pager page={page} setPage={setPage} total={total} totalPages={totalPages} pageSize={pageSize} className='pager' />
      </section>
    </div>
  );
}
