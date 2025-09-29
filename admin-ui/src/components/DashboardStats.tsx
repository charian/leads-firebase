import { Row, Col, Card, Statistic, Skeleton } from "antd";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
// ✨ 수정: 자체 타입 정의를 삭제하고, src/types.ts에서 올바른 타입을 import 합니다.
import type { AdvancedStats } from "../types";

interface DashboardStatsProps {
  stats: AdvancedStats | null;
  loading: boolean;
}

const DashboardStats = ({ stats, loading }: DashboardStatsProps) => {
  if (loading) {
    return (
      <Row gutter={[16, 16]} align='stretch'>
        <Col xs={24} lg={12}>
          <Card style={{ height: "100%" }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card style={{ height: "100%" }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card style={{ height: "100%" }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8} lg={4}>
          <Card style={{ height: "100%" }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
      </Row>
    );
  }

  if (!stats) return null;

  const sources = stats.trend.length > 0 ? Object.keys(stats.trend[0]).filter((key) => key !== "date") : [];
  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F"];
  const formattedTrendData = stats.trend.map((item) => ({ ...item, date: item.date.substring(5) }));

  return (
    <Row gutter={[16, 16]} align='stretch'>
      <Col xs={24} lg={12}>
        <Card title='최근 15일 DB 추가 수 (매체별)' style={{ height: "100%" }}>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={formattedTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='date' />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {sources.map((source, index) => (
                  <Area key={source} type='monotone' dataKey={source} stackId='1' name={source} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={8} lg={4}>
        <Card style={{ height: "100%" }}>
          <Statistic title='오늘 DB 추가 수' value={stats.today?.total || 0} />
        </Card>
      </Col>
      <Col xs={24} sm={8} lg={4}>
        <Card style={{ height: "100%" }}>
          <Statistic title='어제 DB 추가 수' value={stats.yesterday?.total || 0} />
        </Card>
      </Col>
      <Col xs={24} sm={8} lg={4}>
        <Card style={{ height: "100%" }}>
          <Statistic title='누적 DB' value={stats.cumulativeTotal || 0} />
        </Card>
      </Col>
    </Row>
  );
};

export default DashboardStats;
