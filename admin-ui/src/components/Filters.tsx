import { Select, Input, Button, Space } from "antd";
import { SearchOutlined, DownloadOutlined, DeleteOutlined } from "@ant-design/icons";
import type { Filters } from "../types";

type Props = {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReload: () => void;
  onDownload: () => void;
  // ✨ 삭제 기능 관련 props 추가
  onDelete: () => void;
  selectedCount: number;
};

export default function FiltersComponent({ value, onChange, onReload, onDownload, onDelete, selectedCount }: Props) {
  return (
    // ✨ Space와 Divider를 사용하여 레이아웃을 좌우로 분리합니다.
    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
      {/* 왼쪽: 다운로드 및 삭제 버튼 */}
      <Space>
        <Button
          icon={<DownloadOutlined />}
          onClick={onDownload}
          disabled={selectedCount === 0} // ✨ 아이템 선택 시 활성화
        >
          다운로드(CSV)
        </Button>
        <Button
          danger
          type='primary'
          icon={<DeleteOutlined />}
          onClick={onDelete}
          disabled={selectedCount === 0} // ✨ 아이템 선택 시 활성화
        >
          선택 삭제 ({selectedCount})
        </Button>
      </Space>

      {/* 오른쪽: 필터 및 조회 버튼 */}
      <Space wrap>
        <Select value={value.dl} onChange={(dl) => onChange({ dl })} style={{ width: 180 }}>
          <Select.Option value='no'>다운로드 없는 것 (기본)</Select.Option>
          <Select.Option value='all'>전체</Select.Option>
        </Select>
        <Input placeholder='이름' value={value.name} onChange={(e) => onChange({ name: e.target.value })} style={{ width: 120 }} />
        <Input placeholder='전화(검색)' value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} style={{ width: 150 }} />
        <Input placeholder='utm_source' value={value.source} onChange={(e) => onChange({ source: e.target.value })} style={{ width: 150 }} />
        <Select value={value.period} onChange={(period) => onChange({ period })} style={{ width: 120 }}>
          <Select.Option value=''>period 전체</Select.Option>
          <Select.Option value='오전'>오전</Select.Option>
          <Select.Option value='오후'>오후</Select.Option>
        </Select>
        <Button type='primary' icon={<SearchOutlined />} onClick={onReload}>
          조회
        </Button>
      </Space>
    </div>
  );
}
