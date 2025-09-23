import { useState, useEffect } from "react";
import { Card, DatePicker, Button, Spin, Statistic, Row, Col, InputNumber, message, Table, Space } from "antd";
import { getSettlementConfig, setSettlementCost, calculateSettlement } from "../services/settlement";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import weekday from "dayjs/plugin/weekday";
import localeData from "dayjs/plugin/localeData";
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.locale("ko");

const { WeekPicker } = DatePicker;

export const SettlementPage = ({ myRole }: { myRole: "super-admin" | "admin" }) => {
  const [week, setWeek] = useState(dayjs());
  const [costs, setCosts] = useState<{ [year: string]: number }>({});
  const [currentCost, setCurrentCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [settlementData, setSettlementData] = useState<any[]>([]);
  const [total, setTotal] = useState({ downloads: 0, bads: 0, net: 0, amount: 0 });

  const fetchConfig = async () => {
    try {
      const config = await getSettlementConfig();
      setCosts(config.costs || {});
    } catch (e: any) {
      message.error("정산 설정을 불러오는 데 실패했습니다: " + e.message);
    }
  };

  const handleFetchSettlement = async (selectedWeek: dayjs.Dayjs) => {
    setLoading(true);
    try {
      const startOfWeek = selectedWeek.startOf("week").toDate();
      const endOfWeek = selectedWeek.endOf("week").toDate();

      const result = await calculateSettlement(startOfWeek, endOfWeek);
      const data = result.dailyData || [];

      setSettlementData(data);

      const summary = data.reduce(
        (acc, day) => {
          acc.downloads += day.downloads;
          acc.bads += day.bads;
          return acc;
        },
        { downloads: 0, bads: 0 }
      );

      const net = summary.downloads - summary.bads;
      setTotal({
        ...summary,
        net,
        amount: net * result.costPerLead,
      });
    } catch (e: any) {
      message.error("정산 데이터를 불러오는 데 실패했습니다: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (week) {
      handleFetchSettlement(week);
    }
  }, [week, costs]);

  const handleCostChange = (value: number | null) => {
    if (value !== null) {
      setCurrentCost(value);
    }
  };

  const handleSaveCost = async () => {
    const year = week.year().toString();
    try {
      await setSettlementCost(year, currentCost);
      message.success(`${year}년도 건당 비용이 ${currentCost.toLocaleString()}원으로 설정되었습니다.`);
      await fetchConfig();
    } catch (e: any) {
      message.error("비용 설정 저장에 실패했습니다: " + e.message);
    }
  };

  useEffect(() => {
    const year = week.year().toString();
    setCurrentCost(costs[year] || 0);
  }, [week, costs]);

  const columns = [
    { title: "날짜", dataIndex: "date", key: "date" },
    { title: "다운로드", dataIndex: "downloads", key: "downloads" },
    { title: "불량", dataIndex: "bads", key: "bads" },
    { title: "유효", key: "net", render: (_: any, record: any) => record.downloads - record.bads },
  ];

  return (
    <Space direction='vertical' style={{ width: "100%" }} size='large'>
      {myRole === "super-admin" && (
        <Card title={`${week.year()}년도 비용 설정`}>
          <Space>
            <InputNumber
              value={currentCost}
              onChange={handleCostChange}
              formatter={(value) => `₩ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(value) => value!.replace(/₩\s?|(,*)/g, "") as unknown as number}
              style={{ width: 200 }}
            />
            <Button type='primary' onClick={handleSaveCost}>
              저장
            </Button>
          </Space>
        </Card>
      )}

      <Card title='주간 정산'>
        <WeekPicker onChange={(date) => date && setWeek(date)} value={week} style={{ marginBottom: 24 }} />

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
            <Spin />
          </div>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={12} md={6}>
                <Statistic title='총 다운로드' value={total.downloads} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title='총 불량' value={total.bads} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title='총 유효' value={total.net} />
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Statistic title='정산 금액' value={total.amount} prefix='₩' />
              </Col>
            </Row>
            <Table
              columns={columns}
              dataSource={settlementData}
              rowKey='date'
              pagination={false}
              bordered
              summary={() => (
                <Table.Summary.Row style={{ background: "#fafafa", fontWeight: "bold" }}>
                  <Table.Summary.Cell index={0}>합계</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{total.downloads}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{total.bads}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{total.net}</Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </>
        )}
      </Card>
    </Space>
  );
};
