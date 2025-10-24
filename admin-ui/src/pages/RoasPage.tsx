import React, { useState, useEffect, useMemo } from "react";
import { Card, Col, DatePicker, Row, Statistic, Table, Typography, InputNumber, message, Spin, Space } from "antd";
import type { TableProps } from "antd";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { GoogleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { getRoasData, setAdCost } from "../services/roas";
import type { RoasData, RoasPageData, CoreMetrics } from "../types";
import type { StatisticProps } from "antd";

// TikTok 아이콘 (SVG)
const TikTokIcon = () => (
  <svg width='1em' height='1em' fill='currentColor' viewBox='0 0 448 512'>
    <path d='M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z' />
  </svg>
);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const formatCurrency: StatisticProps["formatter"] = (value) => {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `₩ ${Math.round(num).toLocaleString()}`;
};

const formatCount: StatisticProps["formatter"] = (value) => {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `${Math.round(num).toLocaleString()}`;
};

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

const initialCoreMetrics: CoreMetrics = {
  cumulativeCostPerLead: 0,
  thisWeekCostPerLead: 0,
  thisMonthCostPerLead: 0,
  costPerLeadBySource: {},
  adSpendBySource: {},
  leadsBySource: {},
};

const SourceIcon = ({ source }: { source: string }) => {
  if (source.toLowerCase().includes("google")) {
    return <GoogleOutlined style={{ marginRight: 8, color: "#DB4437" }} />;
  }
  if (source.toLowerCase().includes("tiktok")) {
    return <TikTokIcon />;
  }
  return null;
};

const CustomizedXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const date = dayjs(payload.value);
  const day = date.day(); // 0: 일요일, 6: 토요일

  let color = "#666"; // 기본 회색
  if (day === 6) {
    // 토요일
    color = "blue";
  } else if (day === 0) {
    // 일요일
    color = "red";
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor='end' fill={color} transform='rotate(-35)'>
        {date.format("MM-DD")}
      </text>
    </g>
  );
};

export const RoasPage = () => {
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<RoasPageData | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, "day"), dayjs()]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (dateRange) {
        const result = (await getRoasData(dateRange[0].toDate(), dateRange[1].toDate())) as RoasPageData;

        if (result) {
          setPageData(result);
        } else {
          throw new Error("서버에서 응답 데이터를 받지 못했습니다.");
        }
      }
    } catch (e: any) {
      message.error(`데이터를 불러오는 데 실패했습니다: ${e.message}`);
      setPageData(null);
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
      fetchData();
    } catch (e: any) {
      message.error(`광고비 저장에 실패했습니다: ${e.message}`);
    }
  };

  const filteredData = useMemo(() => {
    if (!pageData) return null;
    const metrics = pageData.coreMetrics || {};
    const costPerLeadBySource = metrics.costPerLeadBySource || {};
    const adSpendBySource = metrics.adSpendBySource || {};
    const leadsBySource = metrics.leadsBySource || {};
    return {
      ...pageData,
      roasData: (pageData.roasData || []).filter((d) => d.source !== "N/A").sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source)),
      trendSources: (pageData.trendSources || []).filter((s) => s !== "N/A"),
      coreMetrics: {
        ...initialCoreMetrics,
        ...metrics,
        costPerLeadBySource: Object.fromEntries(Object.entries(costPerLeadBySource).filter(([key]) => key !== "N/A")),
        adSpendBySource: Object.fromEntries(Object.entries(adSpendBySource).filter(([key]) => key !== "N/A")),
        leadsBySource: Object.fromEntries(Object.entries(leadsBySource).filter(([key]) => key !== "N/A")),
      },
    };
  }, [pageData]);

  const columns: TableProps<RoasData>["columns"] = [
    { title: "날짜", dataIndex: "date", key: "date", width: 120 },
    {
      title: "매체",
      dataIndex: "source",
      key: "source",
      width: 150,
      render: (source: string) => (
        <Space>
          <SourceIcon source={source} />
          {source}
        </Space>
      ),
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
    { title: "리드 수", dataIndex: "leads", key: "leads" },
    { title: "총 매출", dataIndex: "revenue", key: "revenue", render: (value) => formatCurrency(value) },
    { title: "ROAS (%)", dataIndex: "roas", key: "roas", render: (roas: number) => `${roas.toFixed(1)}%` },
  ];

  const { coreMetrics = initialCoreMetrics } = filteredData || {};

  return (
    <Spin spinning={loading}>
      <Title level={2} style={{ marginBottom: 24 }}>
        ROAS 분석
      </Title>

      <Card title='최근 30일 광고비 & 리드당 비용 트렌드' style={{ marginBottom: 24 }}>
        <ResponsiveContainer width='100%' height={300}>
          <ComposedChart data={filteredData?.trendData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' height={60} tick={<CustomizedXAxisTick />} interval={0} />
            {/* ✨ 수정: Y축을 하나로 통일 */}
            <YAxis tickFormatter={(value) => `${(Number(value) / 10000).toLocaleString()}만`} />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            {(filteredData?.trendSources || []).map((source, index) => (
              <Area key={source} type='monotone' dataKey={source} stackId='1' stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} />
            ))}
            {/* ✨ 수정: 라인 차트가 왼쪽 Y축을 사용하도록 yAxisId 제거 */}
            <Line type='monotone' dataKey='costPerLead' name='리드당 비용' stroke='#ff7300' strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title='누적 리드당 비용' value={coreMetrics.cumulativeCostPerLead} formatter={formatCurrency} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title='이번 주 리드당 비용' value={coreMetrics.thisWeekCostPerLead} formatter={formatCurrency} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title='이번 달 리드당 비용' value={coreMetrics.thisMonthCostPerLead} formatter={formatCurrency} />
          </Card>
        </Col>
        <Col xs={24} sm={24} md={6}>
          <Card title='매체별 리드 수 (선택 기간)' size='small' bodyStyle={{ paddingTop: 16 }}>
            {Object.keys(coreMetrics.leadsBySource).length > 0 ? (
              <Row gutter={[16, 8]}>
                {Object.entries(coreMetrics.leadsBySource).map(([source, value]) => (
                  <Col span={12} key={source}>
                    <Statistic
                      title={
                        <Space size={4}>
                          <SourceIcon source={source} />
                          {source}
                        </Space>
                      }
                      value={value}
                      formatter={formatCount}
                      suffix='건'
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Text type='secondary'>데이터 없음</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title='매체별 리드당 비용 (선택 기간)'>
            {Object.keys(coreMetrics.costPerLeadBySource).length > 0 ? (
              <Row gutter={[16, 16]}>
                {Object.entries(coreMetrics.costPerLeadBySource).map(([source, value]) => (
                  <Col xs={12} sm={8} key={source}>
                    <Statistic
                      title={
                        <Space size={4}>
                          <SourceIcon source={source} />
                          {source}
                        </Space>
                      }
                      value={value}
                      formatter={formatCurrency}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Text type='secondary'>데이터 없음</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title='매체별 광고비 (선택 기간)'>
            {Object.keys(coreMetrics.adSpendBySource).length > 0 ? (
              <Row gutter={[16, 16]}>
                {Object.entries(coreMetrics.adSpendBySource).map(([source, value]) => (
                  <Col xs={12} sm={8} key={source}>
                    <Statistic
                      title={
                        <Space size={4}>
                          <SourceIcon source={source} />
                          {source}
                        </Space>
                      }
                      value={value}
                      formatter={formatCurrency}
                    />
                  </Col>
                ))}
              </Row>
            ) : (
              <Text type='secondary'>데이터 없음</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card title='매체별 ROAS 상세 데이터'>
        <RangePicker value={dateRange} onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])} style={{ marginBottom: 16 }} />
        <Table
          rowKey={(r) => `${r.date}-${r.source}`}
          dataSource={filteredData?.roasData || []}
          columns={columns}
          pagination={{ pageSize: 100, showSizeChanger: false }}
          size='small'
          rowClassName={(record, index) => {
            const prevRecord = filteredData?.roasData[index - 1];
            if (index > 0 && record.date !== prevRecord?.date) {
              return "date-group-start";
            }
            return "";
          }}
        />
      </Card>
    </Spin>
  );
};
