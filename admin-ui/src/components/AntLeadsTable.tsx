import { useState } from "react";
import { Table, Tag, Input, Button, Space, message, Tooltip } from "antd";
import type { TableProps } from "antd";
import type { Lead } from "../types";
import { formatKST } from "../utils/time";
import { parseUA } from "../utils/ua";
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons";

// 개선된 메모 편집 컴포넌트
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
      setEditing(false); // 성공 시 편집 모드 종료
    } catch (e) {
      // 오류 메시지는 App.tsx에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  if (editing) {
    return (
      <Space.Compact style={{ width: "100%" }}>
        <Input.TextArea value={memo} onChange={(e) => setMemo(e.target.value)} onPressEnter={handleSave} autoSize={{ minRows: 1, maxRows: 3 }} placeholder='메모 입력...' />
        <Button icon={<SaveOutlined />} onClick={handleSave} type='primary' loading={isSaving} />
        <Button
          icon={<CloseOutlined />}
          onClick={() => {
            setEditing(false);
            setMemo(lead.memo || ""); // 수정 취소 시 원래 메모로 복원
          }}
        />
      </Space.Compact>
    );
  }

  return (
    <Tooltip title='클릭하여 메모 수정'>
      <div onClick={() => setEditing(true)} style={{ cursor: "pointer", minHeight: "32px", display: "flex", alignItems: "center", width: "100%" }}>
        <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{lead.memo || <span style={{ color: "#aaa" }}>메모 없음</span>}</span>
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
};

export default function AntLeadsTable({ rows, loading, selectedRowKeys, onSelectionChange, page, pageSize, total, onPageChange, onMemoSave }: Props) {
  // ✨ 요청하신 최종 컬럼 구조
  const columns: TableProps<Lead>["columns"] = [
    { title: "이름", dataIndex: "name", key: "name", width: 100, fixed: "left", render: (name) => <strong>{name}</strong> },
    { title: "전화번호", dataIndex: "phone_raw", key: "phone", width: 150 },
    { title: "지역", dataIndex: "region_ko", key: "location", width: 100 },
    { title: "디바이스", dataIndex: "userAgent", key: "platform", render: (ua) => parseUA(ua).platform, width: 180 },
    { title: "웹브라우저", dataIndex: "userAgent", key: "browser", render: (ua) => parseUA(ua).browser, width: 150 },
    {
      title: "캠페인",
      dataIndex: "utm_campaign",
      key: "utm_campaign",
      render: (s) =>
        s && (
          <Tooltip title={s}>
            <Tag color='green'>{s}</Tag>
          </Tooltip>
        ),
      width: 120,
    },
    {
      title: "미디어",
      dataIndex: "utm_medium",
      key: "utm_medium",
      render: (s) =>
        s && (
          <Tooltip title={s}>
            <Tag color='cyan'>{s}</Tag>
          </Tooltip>
        ),
      width: 120,
    },
    {
      title: "소스",
      dataIndex: "utm_source",
      key: "utm_source",
      render: (s) =>
        s && (
          <Tooltip title={s}>
            <Tag color='blue'>{s}</Tag>
          </Tooltip>
        ),
      width: 120,
    },
    {
      title: "생성일",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (createdAt) => {
        const { date, time } = formatKST(createdAt);
        return `${date} ${time}`;
      },
      width: 200,
    },
    {
      title: "메모",
      key: "memo",
      dataIndex: "memo",
      width: 250,
      fixed: "right",
      render: (_, record) => <MemoEditor lead={record} onSave={onMemoSave} />,
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
      scroll={{ x: 1600 }}
    />
  );
}
