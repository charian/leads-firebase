// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/pages/LeadsPage.tsx

import { useEffect, useState } from "react";
import { App as AntApp, Button, Space, Card } from "antd";
import { DownloadOutlined, DeleteOutlined } from "@ant-design/icons";

import { fetchLeads, updateLeadMemo, setLeadStatus } from "../services/leads";
import { deleteLeadsCall, incrementDownloadsCall, getAdvancedDashboardStatsCall } from "../services/functions";
import { leadsToCsv } from "../utils/csv";
import { useLeads } from "../hooks/useLeads";
import type { Lead, AdvancedStats } from "../types";

import FiltersComponent from "../components/Filters";
import AntLeadsTable from "../components/AntLeadsTable";
import { DashboardStats } from "../components/DashboardStats";

interface LeadsPageProps {
  myRole: "super-admin" | "admin" | "user";
}

export const LeadsPage = ({ myRole }: LeadsPageProps) => {
  const { message, modal } = AntApp.useApp();
  const { confirm } = modal;

  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AdvancedStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<Error | null>(null);

  const { filters, updateFilters, page, setPage, total, pageRows, pageSize } = useLeads(rows);

  const reloadLeads = async () => {
    setLoading(true);
    try {
      const data = await fetchLeads();
      setRows(data);
    } catch (e: any) {
      message.error(`리드 목록을 불러오는 데 실패했습니다: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const reloadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await getAdvancedDashboardStatsCall();
      setStats(data);
    } catch (e: any) {
      setStatsError(e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([reloadLeads(), reloadStats()]);
  }, []);

  const downloadCsv = async () => {
    if (selected.length === 0) {
      message.warning("다운로드할 행을 선택해주세요.");
      return;
    }
    const chosen = rows.filter((r) => selected.includes(r.id));
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
      await reloadLeads();
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
        try {
          await deleteLeadsCall(selected);
          message.success(`${selected.length}개의 리드를 삭제했습니다.`);
          await Promise.all([reloadLeads(), reloadStats()]);
          setSelected([]);
        } catch (e: any) {
          message.error(`삭제 중 오류가 발생했습니다: ${e.message}`);
        }
      },
    });
  };

  const handleMemoSave = async (leadId: string, memo: string, oldMemo: string) => {
    try {
      await updateLeadMemo(leadId, memo, oldMemo);
      setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, memo } : row)));
      message.success("상담내용이 저장되었습니다.");
    } catch (e: any) {
      message.error(`상담내용 저장 중 오류가 발생했습니다: ${e.message}`);
      throw e;
    }
  };

  const handleStatusToggle = async (leadId: string, field: "isBad" | "visited" | "procedure", status: boolean) => {
    const fieldNameMap = {
      isBad: "불량",
      visited: "내원",
      procedure: "시술",
    };
    try {
      await setLeadStatus(leadId, field, status);
      setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, [field]: status } : row)));
      message.success(`${fieldNameMap[field]} 상태를 '${status ? "Y" : "N"}'으로 변경했습니다.`);
    } catch (e: any) {
      message.error(`상태 변경 중 오류: ${e.message}`);
    }
  };

  return (
    <Space direction='vertical' size='large' style={{ width: "100%" }}>
      <DashboardStats stats={stats} loading={statsLoading} error={statsError} />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <FiltersComponent value={filters} onChange={updateFilters} />
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadCsv} disabled={selected.length === 0}>
              다운로드(CSV)
            </Button>
            <Button danger icon={<DeleteOutlined />} disabled={selected.length === 0} onClick={handleDelete}>
              삭제 ({selected.length})
            </Button>
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
          total={total}
          onPageChange={(page) => setPage(page)}
          onMemoSave={handleMemoSave}
          onStatusToggle={handleStatusToggle}
        />
      </Card>
    </Space>
  );
};
