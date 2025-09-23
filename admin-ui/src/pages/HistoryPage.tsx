import { useState, useEffect } from "react";
import { Card, Spin, message, Timeline, Tag, Typography } from "antd";
import { getHistory } from "../services/history";
import type { HistoryLog } from "../types";
import { formatKSTCompact } from "../utils/time";

const { Text, Paragraph } = Typography;

export const HistoryPage = () => {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

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

  const renderAction = (log: HistoryLog) => {
    switch (log.action) {
      case "DOWNLOAD":
        return (
          <>
            <Tag color='blue'>다운로드</Tag>{" "}
            <Text>
              {log.userEmail} 님이 리드 ID({log.leadId})를 다운로드했습니다.
            </Text>
          </>
        );
      case "DELETE":
        return (
          <>
            <Tag color='red'>삭제</Tag>{" "}
            <Text>
              {log.userEmail} 님이 리드 ID({log.leadId})를 삭제했습니다.
            </Text>
          </>
        );
      case "UPDATE_MEMO":
        return (
          <>
            <Tag color='purple'>메모 수정</Tag>
            <Text>
              {log.userEmail} 님이 리드 ID({log.leadId})의 메모를 수정했습니다.
            </Text>
            <Paragraph code style={{ fontSize: 12, marginTop: 4, marginLeft: 20 }}>
              "{log.from}" → "{log.to}"
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
      <Timeline>
        {history.map((log) => (
          <Timeline.Item key={log.id}>
            <div>{renderAction(log)}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>
              {formatKSTCompact(log.timestamp)}
            </Text>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
};
