import { useState, useMemo } from "react";
import { Table, Tag, Input, Button, Space, message, Tooltip, Switch, Grid } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table"; // ✨ 오류 수정: 정확한 경로에서 ColumnsType import
import type { Lead } from "../types";
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { useBreakpoint } = Grid;
const { TextArea } = Input;

// --- 유틸리티 함수들 ---
const formatKSTCompact = (date: any): string => {
  if (!date) return "-";
  const d = date.toDate ? date.toDate() : date;
  return dayjs(d).format("YY-MM-DD HH:mm");
};

const parseReferrer = (referrer: string): { name: string; color: string } => {
  if (!referrer) return { name: "직접 유입", color: "grey" };
  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace("www.", "");
    if (hostname.includes("google")) return { name: "Google", color: "volcano" };
    if (hostname.includes("naver")) return { name: "Naver", color: "green" };
    if (hostname.includes("daum") || hostname.includes("kakao")) return { name: "Daum/Kakao", color: "gold" };
    if (hostname.includes("facebook")) return { name: "Facebook", color: "blue" };
    return { name: hostname, color: "purple" };
  } catch (e) {
    if (referrer.includes("android-app://")) return { name: "Android App", color: "cyan" };
    return { name: "기타", color: "default" };
  }
};

const parseUA = (uaString: string): { platform: string; browser: string } => {
  if (!uaString) return { platform: "Unknown", browser: "Unknown" };
  let platform = "PC";
  if (/Android/.test(uaString)) platform = "Android";
  else if (/iPhone|iPad|iPod/.test(uaString)) platform = "iOS";
  let browser = "Unknown";
  if (uaString.includes("Chrome/")) browser = "Chrome";
  else if (uaString.includes("Firefox/")) browser = "Firefox";
  else if (uaString.includes("Safari/") && !uaString.includes("Chrome/")) browser = "Safari";
  return { platform, browser };
};

// --- 상담내용 편집 컴포넌트 ---
const MemoEditor = ({ lead, onSave }: { lead: Lead; onSave: (leadId: string, memo: string, oldMemo: string) => Promise<void> }) => {
  const [memo, setMemo] = useState(lead.memo || "");
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const originalMemo = lead.memo || "";

  const handleSave = async () => {
    if (memo === originalMemo) {
      setEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(lead.id, memo, originalMemo);
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (editing) {
    return (
      <Space.Compact style={{ width: "100%" }}>
        <TextArea value={memo} onChange={(e) => setMemo(e.target.value)} autoSize={{ minRows: 1, maxRows: 4 }} />
        <Button icon={<SaveOutlined />} onClick={handleSave} type='primary' loading={isSaving} />
        <Button
          icon={<CloseOutlined />}
          onClick={() => {
            setEditing(false);
            setMemo(originalMemo);
          }}
        />
      </Space.Compact>
    );
  }

  return (
    <Tooltip title='클릭하여 수정'>
      <div onClick={() => setEditing(true)} style={{ cursor: "pointer", minHeight: "22px", display: "flex", alignItems: "center" }}>
        {lead.memo || <span style={{ color: "#aaa" }}>내용 없음</span>}
        <Button icon={<EditOutlined />} type='text' size='small' style={{ marginLeft: "auto", opacity: 0.5 }} />
      </div>
    </Tooltip>
  );
};

// --- 테이블 컴포넌트 Props 타입 정의 ---
type Props = {
  myRole: "super-admin" | "admin" | "user";
  rows: Lead[];
  loading: boolean;
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize?: number) => void;
  onMemoSave: (leadId: string, memo: string, oldMemo: string) => Promise<void>;
  onStatusToggle: (leadId: string, field: "isBad" | "visited" | "procedure", status: boolean) => void;
};

// --- 메인 테이블 컴포넌트 ---
export default function AntLeadsTable({ myRole, rows, loading, selectedRowKeys, onSelectionChange, page, pageSize, total, onPageChange, onMemoSave, onStatusToggle }: Props) {
  const screens = useBreakpoint();

  const { columns, totalWidth } = useMemo(() => {
    const isMobile = !screens.md;
    const fixedLeft = isMobile ? undefined : "left";

    const allColumns: { [key: string]: ColumnsType<Lead> } = {
      base: [
        { title: "이름", dataIndex: "name", key: "name", width: 100, render: (name: string) => <strong>{name}</strong>, fixed: fixedLeft },
        { title: "전화번호", dataIndex: "phone_raw", key: "phone", width: 150 },
        { title: "지역", dataIndex: "region_ko", key: "location", width: 100 },
        {
          title: "유입 경로",
          dataIndex: "referrer",
          key: "referrer",
          width: 150,
          render: (_: any, record: Lead) => {
            const source = record.utm_source;
            if (source) return <Tag color='blue'>{source}</Tag>;
            const parsed = parseReferrer(record.referrer || "");
            return <Tag color={parsed.color}>{parsed.name}</Tag>;
          },
        },
      ],
      device: [
        { title: "디바이스", dataIndex: "userAgent", key: "platform", render: (ua = "") => parseUA(ua).platform, width: 100, responsive: ["lg"] },
        { title: "웹브라우저", dataIndex: "userAgent", key: "browser", render: (ua = "") => parseUA(ua).browser, width: 100, responsive: ["lg"] },
      ],
      utm: [
        {
          title: "캠페인",
          dataIndex: "utm_campaign",
          key: "utm_campaign",
          width: 120,
          responsive: ["md"],
          render: (s: string) =>
            s && (
              <Tooltip title={s}>
                <Tag color='green' style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s}
                </Tag>
              </Tooltip>
            ),
        },
      ],
      ip: [
        {
          title: "접속 IP / 도시",
          key: "ip",
          width: 180,
          render: (_: any, record: Lead) => (
            <div>
              <div>{record.ipAddress || "-"}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{record.ipCity || "Unknown"}</div>
            </div>
          ),
        },
      ],
      download: [
        { title: "다운로드", dataIndex: "downloadedBy", key: "downloadedBy", width: 100, align: "center", render: (by: string) => (by ? <Tag color='green'>Y</Tag> : <Tag>N</Tag>) },
        { title: "다운로드 시간", dataIndex: "downloadedAt", key: "downloadedAt", render: (at: any) => (at ? formatKSTCompact(at) : "-"), width: 140 },
        { title: "다운로드 한 사람", dataIndex: "downloadedBy", key: "downloadedBy", width: 180 },
      ],
      actions: [
        { title: "생성일", dataIndex: "createdAt", key: "createdAt", render: (createdAt: any) => formatKSTCompact(createdAt), width: 140 },
        { title: "상담내용", key: "memo", dataIndex: "memo", width: 220, render: (_: any, record: Lead) => <MemoEditor lead={record} onSave={onMemoSave} /> },
        {
          title: "내원",
          dataIndex: "visited",
          key: "visited",
          width: 80,
          align: "center",
          render: (visited: boolean, record: Lead) => <Switch checked={visited} onChange={(checked) => onStatusToggle(record.id, "visited", checked)} />,
        },
        {
          title: "시술",
          dataIndex: "procedure",
          key: "procedure",
          width: 80,
          align: "center",
          render: (procedure: boolean, record: Lead) => <Switch checked={procedure} onChange={(checked) => onStatusToggle(record.id, "procedure", checked)} />,
        },
        {
          title: "불량",
          dataIndex: "isBad",
          key: "isBad",
          width: 80,
          align: "center",
          fixed: isMobile ? undefined : "right",
          render: (isBad: boolean, record: Lead) => <Switch checked={isBad} onChange={(checked) => onStatusToggle(record.id, "isBad", checked)} style={isBad ? { backgroundColor: "#ff4d4f" } : {}} />,
        },
      ],
    };

    let columnsToShow: ColumnsType<Lead> = [...allColumns.base];

    if (myRole === "super-admin" || myRole === "admin") {
      columnsToShow.push(...allColumns.device);
    }
    if (myRole === "super-admin") {
      columnsToShow.push(...allColumns.utm);
      columnsToShow.push(...allColumns.ip);
    }

    if (myRole === "user") {
      if (allColumns.download && allColumns.download.length > 0) {
        columnsToShow.push(allColumns.download[0]);
      }
    } else if (myRole === "super-admin" || myRole === "admin") {
      columnsToShow.push(...allColumns.download);
    }

    columnsToShow.push(...allColumns.actions);

    const totalWidth = columnsToShow.reduce((sum: number, col: any) => sum + (Number(col.width) || 0), 0);

    return { columns: columnsToShow, totalWidth };
  }, [myRole, screens.md, onMemoSave, onStatusToggle]);

  return (
    <Table
      size='small'
      rowKey='id'
      dataSource={rows}
      columns={columns}
      loading={loading}
      rowSelection={{ selectedRowKeys, onChange: (keys: React.Key[]) => onSelectionChange(keys as string[]) }}
      pagination={{
        current: page,
        pageSize: pageSize,
        total: total,
        onChange: onPageChange,
        showSizeChanger: true,
        showTotal: (total, range) => `${total}건 중 ${range[0]}-${range[1]}`,
      }}
      scroll={{ x: totalWidth }}
      rowClassName={(record) => (record.isBad ? "bad-lead-row" : "")}
    />
  );
}
