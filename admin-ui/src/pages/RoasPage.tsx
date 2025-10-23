import { useState, useEffect } from "react";
import { Card, Col, DatePicker, Row, Statistic, Table, Typography, InputNumber, message, Spin } from "antd";
import type { TableProps } from "antd";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { getRoasData, setAdCost } from "../services/roas";
import type { RoasData } from "../types";

const { Title } = Typography;
const { RangePicker } = DatePicker;

const formatCurrency = (value: string | number) => {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `₩ ${Math.round(num).toLocaleString()}`;
};

export const RoasPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RoasData[]>([]);
  const [trendData, setTrendData] = useState([]);
  const [coreMetrics, setCoreMetrics] = useState({
    cumulativeCostPerLead: 0,
    thisWeekCostPerLead: 0,
    thisMonthCostPerLead: 0,
  });
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (dateRange) {
        const result: any = await getRoasData(dateRange[0].toDate(), dateRange[1].toDate());

        // ✅ [수정] 백엔드에서 null이 와도 앱이 멈추지 않도록 방어 코드 추가
        if (result) {
          setData(result.roasData || []);
          setTrendData(result.trendData || []);
          setCoreMetrics(result.coreMetrics || { cumulativeCostPerLead: 0, thisWeekCostPerLead: 0, thisMonthCostPerLead: 0 });
        } else {
          // result가 null이나 undefined일 경우, 빈 데이터로 설정
          setData([]);
          setTrendData([]);
          throw new Error("서버에서 응답 데이터를 받지 못했습니다.");
        }
      }
    } catch (e: any) {
      // 이제 더 구체적인 오류 메시지가 표시됩니다.
      message.error(`데이터를 불러오는 데 실패했습니다: ${e.message}`);
      setData([]);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const handleCostChange = async (record: RoasData, newCost: number | null) => {
    if (newCost === null || newCost < 0 || newCost === record.cost) {
      return;
    }

    try {
      await setAdCost(record.date, record.source, newCost);
      message.success(`${record.date} ${record.source} 광고비가 ${newCost.toLocaleString()}원으로 저장되었습니다.`);
      setData((prev) => prev.map((item) => (item.date === record.date && item.source === record.source ? { ...item, cost: newCost, roas: newCost > 0 ? (item.revenue / newCost) * 100 : 0 } : item)));
    } catch (e: any) {
      message.error(`광고비 저장에 실패했습니다: ${e.message}`);
    }
  };

  const columns: TableProps<RoasData>["columns"] = [
    {
      title: "날짜",
      dataIndex: "date",
      key: "date",
      sorter: (a: RoasData, b: RoasData) => a.date.localeCompare(b.date),
      defaultSortOrder: "descend",
    },
    {
      title: "매체",
      dataIndex: "source",
      key: "source",
      filters: [...new Set(data.map((item) => item.source))].map((s) => ({ text: s, value: s })),
      onFilter: (value: any, record: RoasData) => record.source.indexOf(value) === 0,
    },
    {
      title: "광고비 (소진액)",
      dataIndex: "cost",
      key: "cost",
      render: (cost: number, record: RoasData) => (
        <InputNumber
          defaultValue={cost}
          formatter={(value) => `₩ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          parser={(value) => Number(value?.replace(/₩\s?|(,*)/g, ""))}
          onBlur={(e) => handleCostChange(record, Number(e.target.value.replace(/₩\s?|(,*)/g, "")))}
          style={{ width: 120 }}
        />
      ),
    },
    { title: "리드 수", dataIndex: "leads", key: "leads", sorter: (a: RoasData, b: RoasData) => a.leads - b.leads },
    { title: "총 매출", dataIndex: "revenue", key: "revenue", render: formatCurrency, sorter: (a: RoasData, b: RoasData) => a.revenue - b.revenue },
    { title: "ROAS (%)", dataIndex: "roas", key: "roas", render: (roas: number) => `${roas.toFixed(1)}%`, sorter: (a: RoasData, b: RoasData) => a.roas - b.roas },
  ];

  return (
    <Spin spinning={loading}>
      <Title level={2} style={{ marginBottom: 24 }}>
        ROAS 분석
      </Title>

      <Card title='최근 30일 광고비 트렌드' style={{ marginBottom: 24 }}>
        <ResponsiveContainer width='100%' height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value) => `${(value / 10000).toLocaleString()}만`} />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            <Line type='monotone' dataKey='cost' name='광고비' stroke='#8884d8' />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title='누적 리드당 비용' value={"추후 제공"} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title='이번 주 리드당 비용' value={coreMetrics.thisWeekCostPerLead} formatter={formatCurrency} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title='이번 달 리드당 비용' value={coreMetrics.thisMonthCostPerLead} formatter={formatCurrency} />
          </Card>
        </Col>
      </Row>

      <Card title='매체별 ROAS 분석'>
        <RangePicker value={dateRange} onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])} style={{ marginBottom: 16 }} />
        <Table rowKey={(r) => `${r.date}-${r.source}`} dataSource={data} columns={columns} pagination={{ pageSize: 100 }} />
      </Card>
    </Spin>
  );
};
