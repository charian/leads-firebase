import { Select, Input, Space, DatePicker } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Filters } from "../types";
import type { RangePickerProps } from "antd/es/date-picker";

const { RangePicker } = DatePicker;

type Props = {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
};

// ✨ 수정: 날짜 범위 선택기에 추가할 프리셋 정의
const rangePresets: RangePickerProps["presets"] = [
  { label: "오늘", value: [dayjs().startOf("day"), dayjs().endOf("day")] },
  { label: "최근 7일", value: [dayjs().subtract(7, "d").startOf("day"), dayjs()] },
  { label: "최근 30일", value: [dayjs().subtract(30, "d").startOf("day"), dayjs()] },
  { label: "이번 달", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
  { label: "지난 달", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
];

export default function FiltersComponent({ value, onChange }: Props) {
  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    onChange({ dateRange: dates });
  };

  return (
    <Space wrap>
      {/* ✨ 수정: presets 속성 추가 */}
      <RangePicker presets={rangePresets} value={value.dateRange} onChange={handleDateChange} disabledDate={(current) => current && current > dayjs().endOf("day")} />
      <Select value={value.status} onChange={(status) => onChange({ status })} style={{ width: 120 }}>
        <Select.Option value='all'>전체</Select.Option>
        <Select.Option value='good'>정상</Select.Option>
        <Select.Option value='bad'>불량</Select.Option>
      </Select>
      <Select value={value.dl} onChange={(dl) => onChange({ dl })} style={{ width: 140 }}>
        <Select.Option value='all'>다운로드 전체</Select.Option>
        <Select.Option value='yes'>다운로드 완료</Select.Option>
        <Select.Option value='no'>다운로드 안함</Select.Option>
      </Select>
      <Input placeholder='이름' value={value.name} onChange={(e) => onChange({ name: e.target.value })} style={{ width: 120 }} allowClear />
      <Input placeholder='전화번호' value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} style={{ width: 150 }} allowClear />
    </Space>
  );
}
