import { useEffect, useState, useMemo } from "react";
import { App as AntApp, Button, Space, Card } from "antd";
import { DownloadOutlined, DeleteOutlined } from "@ant-design/icons";

import { fetchLeads, updateLeadMemo, setLeadBadStatus } from "../services/leads";
import { deleteLeadsCall, incrementDownloadsCall, getAdvancedDashboardStats } from "../services/functions";
import { leadsToCsv } from "../utils/csv";
import type { Lead, AdvancedStats, Filters } from "../types";

import FiltersComponent from "../components/Filters";
import AntLeadsTable from "../components/AntLeadsTable";
import DashboardStats from "../components/DashboardStats";
import dayjs from "dayjs";

interface LeadsPageProps {
  myRole: "super-admin" | "admin" | "user";
}

export const LeadsPage = ({ myRole }: LeadsPageProps) => {
  const { message, modal } = AntApp.useApp();
  const { confirm } = modal;

  // ✨ 수정: 'rows'를 'allLeads'로 명명하여 전체 원본 데이터를 명확히 합니다.
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // 이제 이 로딩 상태 하나만 사용합니다.
  const [stats, setStats] = useState<AdvancedStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ✨ 수정: 외부 useLeads 훅을 제거하고, 필터와 페이지 상태를 컴포넌트 내부에서 직접 관리합니다.
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    status: "all",
    dl: "all",
    name: "",
    phone: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // 페이지 당 보여줄 리드 수

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1); // 필터 변경 시 항상 첫 페이지로 이동
  };

  // ✨ 수정: 필터링 로직을 useMemo를 사용하여 효율적으로 처리합니다.
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      if (!lead.createdAt || !lead.createdAt.toDate) return false; // 데이터 무결성 검사
      const createdAt = dayjs(lead.createdAt.toDate());
      if (filters.dateRange?.[0] && createdAt.isBefore(filters.dateRange[0], "day")) return false;
      if (filters.dateRange?.[1] && createdAt.isAfter(filters.dateRange[1], "day")) return false;
      if (filters.status === "good" && lead.isBad) return false;
      if (filters.status === "bad" && !lead.isBad) return false;
      if (filters.dl === "yes" && lead.download === 0) return false;
      if (filters.dl === "no" && lead.download > 0) return false;
      if (filters.name && !lead.name.toLowerCase().includes(filters.name.toLowerCase().trim())) return false;
      if (filters.phone && !lead.phone_raw.replace(/-/g, "").includes(filters.phone.replace(/-/g, ""))) return false;
      return true;
    });
  }, [allLeads, filters]);

  // 페이지네이션을 위한 데이터 슬라이싱
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredLeads.slice(start, end);
  }, [filteredLeads, page, pageSize]);

  // ✨ 수정: 모든 데이터 로딩을 이 하나의 useEffect에서 처리하여 문제를 단순화합니다.
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setStatsLoading(true);
      try {
        const [statsData, leadsData] = await Promise.all([getAdvancedDashboardStats(), fetchLeads()]);

        if (statsData?.trend) {
          statsData.trend = statsData.trend.slice(-15);
        }
        setStats(statsData);
        setAllLeads(leadsData);
      } catch (error: any) {
        console.error("Failed to load page data:", error);
        message.error(`초기 데이터 로딩에 실패했습니다: ${error.message}`);
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };
    void loadInitialData();
  }, []); // 페이지가 처음 로드될 때 단 한 번만 실행됩니다.

  const downloadCsv = async () => {
    if (selected.length === 0) {
      message.warning("다운로드할 행을 선택해주세요.");
      return;
    }
    const chosen = allLeads.filter((r) => selected.includes(r.id));
    const csv = leadsToCsv(chosen);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_selected_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      await incrementDownloadsCall(chosen.map((r) => r.id));
      const updatedRows = allLeads.map((row) => (chosen.find((c) => c.id === row.id) ? { ...row, download: row.download + 1 } : row));
      setAllLeads(updatedRows);
      message.success(`${chosen.length}건의 다운로드 정보를 업데이트했습니다.`);
    } catch (e: any) {
      message.error(`다운로드 정보 업데이트 실패: ${e?.message}`);
    }
  };

  const handleDelete = () => {
    if (selected.length === 0) {
      message.warning("삭제할 리드를 선택해주세요.");
      return;
    }
    confirm({
      title: `${selected.length}개의 리드를 정말 삭제하시겠습니까?`,
      content: "삭제된 데이터는 복구할 수 없습니다.",
      okText: "삭제",
      okType: "danger",
      cancelText: "취소",
      onOk: async () => {
        setLoading(true);
        try {
          await deleteLeadsCall(selected);
          setAllLeads(allLeads.filter((r) => !selected.includes(r.id)));
          message.success(`${selected.length}개의 리드를 삭제했습니다.`);
          setSelected([]);
        } catch (e: any) {
          message.error(`삭제 중 오류가 발생했습니다: ${e.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleMemoSave = async (leadId: string, memo: string, oldMemo: string) => {
    try {
      await updateLeadMemo(leadId, memo, oldMemo);
      setAllLeads((prev) => prev.map((row) => (row.id === leadId ? { ...row, memo } : row)));
      message.success("메모가 저장되었습니다.");
    } catch (e: any) {
      message.error(`메모 저장 중 오류가 발생했습니다: ${e.message}`);
      throw e;
    }
  };

  const handleBadLeadToggle = async (leadId: string, isBad: boolean) => {
    try {
      await setLeadBadStatus(leadId, isBad);
      setAllLeads((prev) => prev.map((row) => (row.id === leadId ? { ...row, isBad } : row)));
      message.success(`리드 상태를 '${isBad ? "불량" : "정상"}'으로 변경했습니다.`);
    } catch (e: any) {
      message.error(`상태 변경 중 오류: ${e.message}`);
    }
  };

  return (
    <Space direction='vertical' size='large' style={{ width: "100%" }}>
      <DashboardStats stats={stats} loading={statsLoading} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <FiltersComponent value={filters} onChange={updateFilters} />
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadCsv} disabled={selected.length === 0}>
              다운로드(CSV)
            </Button>
            {(myRole === "super-admin" || myRole === "admin") && (
              <Button danger icon={<DeleteOutlined />} disabled={selected.length === 0} onClick={handleDelete}>
                삭제 ({selected.length})
              </Button>
            )}
          </Space>
        </div>

        <AntLeadsTable
          myRole={myRole}
          rows={pageRows}
          loading={loading}
          selectedRowKeys={selected}
          onSelectionChange={setSelected}
          page={page}
          pageSize={pageSize}
          total={filteredLeads.length}
          onPageChange={setPage}
          onMemoSave={handleMemoSave}
          onBadLeadToggle={handleBadLeadToggle}
        />
      </Card>
    </Space>
  );
};
