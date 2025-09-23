import { useEffect, useState } from "react";
import { App as AntApp, Button, Space, Card } from "antd";
import { DownloadOutlined, DeleteOutlined } from "@ant-design/icons";

import { fetchLeads, updateLeadMemo, setLeadBadStatus } from "../services/leads";
import { deleteLeadsCall, incrementDownloadsCall } from "../services/functions";
import { leadsToCsv } from "../utils/csv";
import { useLeads } from "../hooks/useLeads";
import type { Lead } from "../types";

import FiltersComponent from "../components/Filters";
import AntLeadsTable from "../components/AntLeadsTable";

export const LeadsPage = () => {
  const { message, modal } = AntApp.useApp();
  const { confirm } = modal;

  const [rows, setRows] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const { filters, updateFilters, page, setPage, total, pageRows, pageSize } = useLeads(rows);

  const reload = async () => {
    setLoading(true);
    const data = await fetchLeads();
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, [filters]);

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
      await reload(); // Reload to get updated download info
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
          message.success(`${selected.length}개의 리드를 삭제했습니다.`);
          await reload();
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
      setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, memo } : row)));
      message.success("메모가 저장되었습니다.");
    } catch (e: any) {
      message.error(`메모 저장 중 오류가 발생했습니다: ${e.message}`);
      throw e; // Propagate error to child component
    }
  };

  const handleBadLeadToggle = async (leadId: string, isBad: boolean) => {
    try {
      await setLeadBadStatus(leadId, isBad);
      setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, isBad } : row)));
      message.success(`리드 상태를 '${isBad ? "불량" : "정상"}'으로 변경했습니다.`);
    } catch (e: any) {
      message.error(`상태 변경 중 오류: ${e.message}`);
    }
  };

  return (
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
        rows={pageRows}
        loading={loading}
        selectedRowKeys={selected}
        onSelectionChange={setSelected}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(page, size) => {
          setPage(page);
          // Optional: handle page size change if needed
        }}
        onMemoSave={handleMemoSave}
        onBadLeadToggle={handleBadLeadToggle}
      />
    </Card>
  );
};
