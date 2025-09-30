// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/components/DashboardStats.tsx

import { Card, Row, Col, Spin, Alert } from "antd";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { AdvancedStats } from "../types";

const sourceColorMap = new Map<string, string>();
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

const getSourceColor = (source: string, index: number) => {
  if (!sourceColorMap.has(source)) {
    sourceColorMap.set(source, COLORS[index % COLORS.length]);
  }
  return sourceColorMap.get(source)!;
};

// Pie Chart를 위한 데이터 변환 함수
const transformSourceDataForPie = (sourceData: { [key: string]: number }) => {
  return Object.entries(sourceData).map(([name, value]) => ({ name, value }));
};

type Props = {
  stats: AdvancedStats | null;
  loading: boolean;
  error: Error | null;
};

// 작은 Pie Chart 컴포넌트
const SourcePieChart = ({ title, data }: { title: string; data: { name: string; value: number }[] }) => (
  <Card title={title}>
    {/* ✨ 높이 수정: 250 -> 150 */}
    <ResponsiveContainer width='100%' height={150}>
      <PieChart>
        <Pie
          data={data}
          cx='50%'
          cy='50%'
          labelLine={false}
          outerRadius={60} // 높이에 맞춰 크기 조정
          fill='#8884d8'
          dataKey='value'
          nameKey='name'
          label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getSourceColor(entry.name, index)} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </Card>
);

export const DashboardStats = ({ stats, loading, error }: Props) => {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert message='데이터 로딩 실패' description={error.message} type='error' showIcon />;
  }

  if (!stats) {
    return <Alert message='표시할 데이터가 없습니다.' type='info' showIcon />;
  }

  const formattedTrendData = stats.trend.map((item) => ({
    ...item,
    date: item.date.substring(5),
  }));

  return (
    <Row gutter={[24, 24]}>
      {/* ✨ 너비 수정: 40% (span 10/24) */}
      <Col xs={24} xl={10}>
        <Card title='지난 30일 유입 추이'>
          {/* ✨ 높이 수정: 250 -> 150 */}
          <ResponsiveContainer width='100%' height={150}>
            <AreaChart data={formattedTrendData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {stats.sources.map((source, index) => (
                <Area key={source} type='monotone' dataKey={source} stackId='1' stroke={getSourceColor(source, index)} fill={getSourceColor(source, index)} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      {/* ✨ 너비 수정: 20% (span 5/24) */}
      <Col xs={24} sm={12} xl={5}>
        <SourcePieChart title={`오늘 DB (${stats.today.total}건)`} data={transformSourceDataForPie(stats.today.bySource)} />
      </Col>

      {/* ✨ 너비 수정: 20% (span 5/24) */}
      <Col xs={24} sm={12} xl={5}>
        <SourcePieChart title={`어제 DB (${stats.yesterday.total}건)`} data={transformSourceDataForPie(stats.yesterday.bySource)} />
      </Col>

      {/* ✨ 너비 수정: 20% (span 4/24, to fit) */}
      <Col xs={24} xl={4}>
        <SourcePieChart title={`누적 DB (${stats.cumulativeTotal}건)`} data={transformSourceDataForPie(stats.cumulativeBySource)} />
      </Col>
    </Row>
  );
};
