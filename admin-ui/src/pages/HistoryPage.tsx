// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/pages/HistoryPage.tsx

import { useState, useEffect, useMemo } from "react";
import { Card, Spin, message, Timeline, Tag, Typography, Space, Select, DatePicker } from "antd";
import { getHistory } from "../services/history";
import type { HistoryLog } from "../types";
import { formatKST } from "../utils/time";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export const HistoryPage = () => {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  // ✨ 필터 상태 관리
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const historyData = await getHistory();
      setHistory(historyData);
    } catch (e: any) {
      message.error("히스토리를 불러오는 데 실패했습니다: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // ✨ 필터링된 데이터
  const filteredHistory = useMemo(() => {
    return history.filter((log) => {
      // 액션 필터
      if (actionFilter !== "all" && log.action !== actionFilter) {
        return false;
      }

      // 날짜 필터
      if (dateFilter && dateFilter[0] && dateFilter[1]) {
        const logDate = dayjs(log.timestamp.toDate());
        if (logDate.isBefore(dateFilter[0], "day") || logDate.isAfter(dateFilter[1], "day")) {
          return false;
        }
      }

      return true;
    });
  }, [history, actionFilter, dateFilter]);

  const renderAction = (log: HistoryLog) => {
    const { time } = formatKST(log.timestamp);
    // ✨ 리드 ID 대신 이름(전화번호) 표시
    const leadIdentifier = log.leadName ? `${log.leadName}(${log.leadPhone || "번호없음"})` : `리드 ID(${log.leadId})`;

    const actionText = (
      <Text>
        <Text strong>{log.userEmail}</Text> 님이 <Text strong>{leadIdentifier}</Text> 리드를
      </Text>
    );

    switch (log.action) {
      case "DOWNLOAD":
        return (
          <>
            <Tag color='blue'>다운로드</Tag> {actionText} 다운로드했습니다.
          </>
        );
      case "DELETE":
        return (
          <>
            <Tag color='red'>삭제</Tag> {actionText} 삭제했습니다.
          </>
        );
      case "UPDATE_MEMO":
        return (
          <>
            <Tag color='purple'>메모 수정</Tag> {actionText}의 메모를 수정했습니다.
            <Paragraph copyable code style={{ fontSize: 12, marginTop: 4, marginLeft: 20 }}>
              "{log.from || "없음"}" → "{log.to || "없음"}"
            </Paragraph>
          </>
        );
      default:
        return <Text>알 수 없는 활동: {log.action}</Text>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 50 }}>
        <Spin />
      </div>
    );
  }

  return (
    <Card title='최근 활동 히스토리 (최대 100건)'>
      {/* ✨ 필터 UI 추가 */}
      <Space style={{ marginBottom: 24 }} wrap>
        <Select value={actionFilter} onChange={setActionFilter} style={{ width: 150 }}>
          <Select.Option value='all'>모든 활동</Select.Option>
          <Select.Option value='DOWNLOAD'>다운로드</Select.Option>
          <Select.Option value='DELETE'>삭제</Select.Option>
          <Select.Option value='UPDATE_MEMO'>메모 수정</Select.Option>
        </Select>
        <RangePicker value={dateFilter} onChange={(dates) => setDateFilter(dates as [Dayjs | null, Dayjs | null] | null)} />
      </Space>

      <Timeline>
        {filteredHistory.map((log) => {
          const { date, time } = formatKST(log.timestamp);
          return (
            <Timeline.Item key={log.id}>
              {renderAction(log)}
              {/* ✨ 시간 표시 개선 */}
              <Text type='secondary' style={{ fontSize: 12, marginLeft: 8 }}>
                {date} {time}
              </Text>
            </Timeline.Item>
          );
        })}
      </Timeline>
    </Card>
  );
};
