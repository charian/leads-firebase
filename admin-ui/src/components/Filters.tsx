import type { Filters } from "../types";

type Props = {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReload: () => void;
  onDownload: () => void;
  className?: string;
};

export default function Filters({ value, onChange, onReload, onDownload, className = "" }: Props) {
  return (
    <div className={`toolbar ${className}`}>
      <select className='select' value={value.dl} onChange={(e) => onChange({ dl: e.target.value as Filters["dl"] })}>
        <option value='no'>다운로드 없는 것 (기본)</option>
        <option value='all'>전체</option>
      </select>
      <input className='input' placeholder='이름' value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
      <input className='input' placeholder='전화(검색)' value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      <input className='input' placeholder='utm_source' value={value.source} onChange={(e) => onChange({ source: e.target.value })} />
      <select className='select' value={value.period} onChange={(e) => onChange({ period: e.target.value as any })}>
        <option value=''>period 전체</option>
        <option value='오전'>오전</option>
        <option value='오후'>오후</option>
      </select>
      <div className='btns'>
        <button className='btn' onClick={onReload}>
          조회
        </button>
        <button className='btn btn-d' onClick={onDownload} style={{ marginLeft: 8 }}>
          다운로드(CSV)
        </button>
      </div>
    </div>
  );
}
