import { useState } from "react";
// ✨ 수정: 사용하지 않는 컴포넌트와 아이콘을 정리합니다.
import { Table, Tag, Input, Button, Space, message, Tooltip } from "antd";
import type { TableProps } from "antd";
import type { Lead } from "../types";
import { formatKSTCompact } from "../utils/time";
import { parseUA } from "../utils/ua";
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons";

// --- 메모 편집 컴포넌트 ---
const MemoEditor = ({ lead, onSave }: { lead: Lead; onSave: (leadId: string, memo: string) => Promise<void> }) => {
  const [memo, setMemo] = useState(lead.memo || "");
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (memo === (lead.memo || "")) {
      message.info("변경된 내용이 없습니다.");
      setEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(lead.id, memo);
      setEditing(false);
    } catch (e) {
      // 오류 메시지는 상위 컴포넌트에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  if (editing) {
    return (
      <Space.Compact style={{ width: "100%" }}>
        <Input.TextArea value={memo} onChange={(e) => setMemo(e.target.value)} onPressEnter={handleSave} autoSize={{ minRows: 1, maxRows: 3 }} />
        <Button icon={<SaveOutlined />} onClick={handleSave} type='primary' loading={isSaving} />
        <Button
          icon={<CloseOutlined />}
          onClick={() => {
            setEditing(false);
            setMemo(lead.memo || "");
          }}
        />
      </Space.Compact>
    );
  }

  return (
    <Tooltip title='클릭하여 메모 수정'>
      <div onClick={() => setEditing(true)} style={{ cursor: "pointer", minHeight: "32px", display: "flex", alignItems: "center" }}>
        {lead.memo || <span style={{ color: "#aaa" }}>메모 없음</span>}
        <Button icon={<EditOutlined />} type='text' size='small' style={{ marginLeft: "auto", opacity: 0.5 }} />
      </div>
    </Tooltip>
  );
};

type Props = {
  rows: Lead[];
  loading: boolean;
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize?: number) => void;
  onMemoSave: (leadId: string, memo: string) => Promise<void>;
  onBadLeadToggle: (leadId: string, isBad: boolean) => Promise<void>;
};

export default function AntLeadsTable({ rows, loading, selectedRowKeys, onSelectionChange, page, pageSize, total, onPageChange, onMemoSave, onBadLeadToggle }: Props) {
  const columns: TableProps<Lead>["columns"] = [
    {
      title: "이름",
      dataIndex: "name",
      key: "name",
      width: 100,
      render: (name) => <strong>{name}</strong>,
    },
    { title: "전화번호", dataIndex: "phone_raw", key: "phone", width: 150 },
    { title: "지역", dataIndex: "region_ko", key: "location", width: 100 },
    {
      title: "디바이스",
      dataIndex: "userAgent",
      key: "platform",
      render: (ua) => parseUA(ua).platform.split(" ")[0],
      width: 120,
      responsive: ["lg"],
    },
    {
      title: "웹브라우저",
      dataIndex: "userAgent",
      key: "browser",
      render: (ua) => parseUA(ua).browser.split(" ")[0],
      width: 120,
      responsive: ["lg"],
    },
    {
      title: "생성일",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt) => formatKSTCompact(createdAt),
      width: 160,
    },
    {
      title: "다운로드",
      dataIndex: "download",
      key: "download",
      width: 100,
      align: "center",
      render: (download) => {
        const count = Number(download || 0);
        return <Tag color={count > 0 ? "green" : "default"}>{count > 0 ? "Y" : "N"}</Tag>;
      },
    },
    {
      title: "다운로드 시간",
      dataIndex: "downloadedAt",
      key: "downloadedAt",
      width: 160,
      render: (downloadedAt) => (downloadedAt ? formatKSTCompact(downloadedAt) : "-"),
    },
    {
      title: "다운로드 한 사람",
      dataIndex: "downloadedBy",
      key: "downloadedBy",
      width: 180,
      render: (email) => email || "-",
    },
    {
      title: "메모",
      key: "memo",
      dataIndex: "memo",
      width: 220,
      render: (_, record) => <MemoEditor lead={record} onSave={onMemoSave} />,
    },
    {
      title: "상태 변경",
      key: "action",
      fixed: "right",
      width: 120,
      align: "center",
      render: (_, record) =>
        record.isBad ? (
          <Button size='small' onClick={() => onBadLeadToggle(record.id, false)}>
            정상으로 전환
          </Button>
        ) : (
          <Button size='small' danger onClick={() => onBadLeadToggle(record.id, true)}>
            불량으로 전환
          </Button>
        ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => onSelectionChange(keys as string[]),
  };

  return (
    <Table
      rowKey='id'
      dataSource={rows}
      columns={columns}
      loading={loading}
      rowSelection={rowSelection}
      pagination={{
        current: page,
        pageSize: pageSize,
        total: total,
        onChange: onPageChange,
        showSizeChanger: true,
        showTotal: (total, range) => `${total}건 중 ${range[0]}-${range[1]}`,
      }}
      scroll={{ x: 1800 }}
      rowClassName={(record) => (record.isBad ? "bad-lead-row" : "")}
    />
  );
}
