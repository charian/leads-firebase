import { Select, Input, Space, DatePicker } from "antd";
// ✨ 수정: 사용하지 않는 Button과 아이콘 제거
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { Filters } from "../types";

const { RangePicker } = DatePicker;

type Props = {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
};

export default function FiltersComponent({ value, onChange }: Props) {
  // ✨ 수정: Ant Design의 RangePicker onChange 타입에 맞게 핸들러를 명시적으로 정의합니다.
  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    onChange({ dateRange: dates });
  };

  return (
    <Space wrap>
      <RangePicker value={value.dateRange} onChange={handleDateChange} disabledDate={(current) => current && current > dayjs().endOf("day")} />
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
      <Input placeholder='이름' value={value.name} onChange={(e) => onChange({ name: e.target.value })} style={{ width: 120 }} />
      <Input placeholder='전화번호' value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} style={{ width: 150 }} />
    </Space>
  );
}
