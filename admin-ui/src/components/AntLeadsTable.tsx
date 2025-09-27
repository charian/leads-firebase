import { useState } from "react";
import { Table, Tag, Input, Button, Space, message, Tooltip } from "antd";
import type { TableProps } from "antd";
import type { Lead } from "../types";
import { SaveOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

// --- 유틸리티 함수들 (오류 해결을 위해 파일 내에 직접 정의) ---

/**
 * 날짜 객체나 문자열을 한국 표준시(KST) 기준 'YY-MM-DD HH:mm' 형식으로 변환합니다.
 * @param date - 변환할 날짜 (Date 객체, 타임스탬프 등)
 * @returns 포맷팅된 날짜 문자열
 */
const formatKSTCompact = (date: any): string => {
  if (!date) return "-";
  // Firestore Timestamp 객체 대응
  const d = date.toDate ? date.toDate() : date;
  return dayjs(d).format("YY-MM-DD HH:mm");
};

/**
 * User Agent 문자열을 파싱하여 주요 플랫폼과 브라우저 정보를 반환합니다.
 * @param uaString - User Agent 문자열
 * @returns 플랫폼과 브라우저 정보를 담은 객체
 */
const parseUA = (uaString: string): { platform: string; browser: string } => {
  if (!uaString) return { platform: "Unknown", browser: "Unknown" };

  // 간단한 User Agent 파싱 로직
  let platform = "PC";
  if (/Android/.test(uaString)) platform = "Android";
  else if (/iPhone|iPad|iPod/.test(uaString)) platform = "iOS";

  let browser = "Unknown";
  if (uaString.includes("Chrome/")) browser = "Chrome";
  else if (uaString.includes("Firefox/")) browser = "Firefox";
  else if (uaString.includes("Safari/") && !uaString.includes("Chrome/")) browser = "Safari";

  return { platform, browser };
};

/**
 * Referrer URL을 분석하여 유입 경로의 이름과 태그 색상을 반환합니다.
 * @param referrer - Referrer URL 문자열
 * @returns 유입 경로 이름과 색상을 담은 객체
 */
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

// --- 메모 편집 컴포넌트 ---
const MemoEditor = ({ lead, onSave }: { lead: Lead; onSave: (leadId: string, memo: string, oldMemo: string) => Promise<void> }) => {
  const [memo, setMemo] = useState(lead.memo || "");
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const originalMemo = lead.memo || "";

  const handleSave = async () => {
    if (memo === originalMemo) {
      message.info("변경된 내용이 없습니다.");
      setEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(lead.id, memo, originalMemo);
      setEditing(false);
    } catch (e) {
      // 에러 처리는 상위 컴포넌트에서 담당
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
            setMemo(originalMemo);
          }}
        />
      </Space.Compact>
    );
  }

  return (
    <Tooltip title='클릭하여 메모 수정'>
      <div onClick={() => setEditing(true)} style={{ cursor: "pointer", minHeight: "22px", display: "flex", alignItems: "center" }}>
        {lead.memo || <span style={{ color: "#aaa" }}>메모 없음</span>}
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
  onBadLeadToggle: (leadId: string, isBad: boolean) => Promise<void>;
};

// --- 메인 테이블 컴포넌트 ---
export default function AntLeadsTable({ myRole, rows, loading, selectedRowKeys, onSelectionChange, page, pageSize, total, onPageChange, onMemoSave, onBadLeadToggle }: Props) {
  // 역할(role)에 따라 동적으로 컬럼을 구성하는 함수
  const getColumns = (): TableProps<Lead>["columns"] => {
    const baseColumns: TableProps<Lead>["columns"] = [
      { title: "이름", dataIndex: "name", key: "name", width: 100, render: (name) => <strong>{name}</strong>, fixed: "left" },
      { title: "전화번호", dataIndex: "phone_raw", key: "phone", width: 150 },
      { title: "지역", dataIndex: "region_ko", key: "location", width: 100 },
      {
        title: "유입 경로",
        dataIndex: "referrer",
        key: "referrer",
        width: 150,
        render: (referrer) => {
          const parsed = parseReferrer(referrer);
          return <Tag color={parsed.color}>{parsed.name}</Tag>;
        },
      },
      { title: "디바이스", dataIndex: "userAgent", key: "platform", render: (ua) => parseUA(ua).platform.split(" ")[0], width: 120, responsive: ["lg"] },
      { title: "웹브라우저", dataIndex: "userAgent", key: "browser", render: (ua) => parseUA(ua).browser.split(" ")[0], width: 120, responsive: ["lg"] },
    ];

    const utmColumns: TableProps<Lead>["columns"] = [
      {
        title: "캠페인",
        dataIndex: "utm_campaign",
        key: "utm_campaign",
        render: (s: string) =>
          s && (
            <Tooltip title={s}>
              <Tag color='green' style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s}
              </Tag>
            </Tooltip>
          ),
        width: 120,
        responsive: ["md"],
      },
      {
        title: "미디어",
        dataIndex: "utm_medium",
        key: "utm_medium",
        render: (s: string) =>
          s && (
            <Tooltip title={s}>
              <Tag color='cyan' style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s}
              </Tag>
            </Tooltip>
          ),
        width: 120,
        responsive: ["md"],
      },
      {
        title: "소스",
        dataIndex: "utm_source",
        key: "utm_source",
        render: (s: string) =>
          s && (
            <Tooltip title={s}>
              <Tag color='blue' style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                {s}
              </Tag>
            </Tooltip>
          ),
        width: 120,
        responsive: ["md"],
      },
    ];

    const downloadColumns: TableProps<Lead>["columns"] = [
      { title: "다운로드", dataIndex: "downloadedBy", key: "downloadedBy", width: 120, align: "center", render: (by: string) => (by ? <Tag color='green'>Y</Tag> : <Tag>N</Tag>) },
      { title: "다운로드 시간", dataIndex: "downloadedAt", key: "downloadedAt", render: (at: any) => (at ? formatKSTCompact(at) : "-"), width: 160 },
      { title: "다운로드 한 사람", dataIndex: "downloadedBy", key: "downloadedBy", width: 180 },
    ];

    const actionColumns: TableProps<Lead>["columns"] = [
      { title: "생성일", dataIndex: "createdAt", key: "createdAt", render: (createdAt) => formatKSTCompact(createdAt), width: 160 },
      { title: "메모", key: "memo", dataIndex: "memo", width: 220, render: (_: any, record: Lead) => <MemoEditor lead={record} onSave={onMemoSave} /> },
      {
        title: "상태 변경",
        key: "action",
        width: 120,
        align: "center",
        fixed: "right",
        render: (_: any, record: Lead) =>
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

    let columns = [...baseColumns];
    if (myRole === "super-admin") {
      columns.push(...utmColumns);
    }
    if (myRole === "super-admin" || myRole === "admin") {
      columns.push(...downloadColumns);
    }
    columns.push(...actionColumns);

    return columns;
  };

  return (
    <Table
      size='small'
      rowKey='id'
      dataSource={rows}
      columns={getColumns()}
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
      scroll={{ x: 1800 }}
      rowClassName={(record) => (record.isBad ? "bad-lead-row" : "")}
    />
  );
}
